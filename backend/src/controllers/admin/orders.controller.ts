import {FastifyRequest, FastifyReply} from 'fastify'
import * as ordersService from '../../services/admin/orders.service.js'
import {generateTicketQRCode, generateTicketUrl} from '../../services/qrcode.service.js'
import {sendEmailByPurpose} from '../../services/email.service.js'
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from '../../utils/errors.js'
import {requireAdmin} from '../../utils/auth.js'

/**
 * GET /api/admin/orders
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const query = request.query as ordersService.ListOrdersInput
  const result = await ordersService.listOrders(query)

  return reply.send({success: true, data: result})
}

/**
 * GET /api/admin/orders/:id
 */
export async function getById(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const {id} = request.params as {id: string}
  const order = await ordersService.getOrderById(id)

  if (!order) throw new NotFoundError('Order not found')

  return reply.send({success: true, data: order})
}

/**
 * POST /api/admin/orders/:id/confirm
 */
export async function confirmPayment(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const {id} = request.params as {id: string}
  const body = (request.body || {}) as {templateId?: string}
  const templateId = body.templateId
  const ipAddress = request.ip
  const userAgent = request.headers['user-agent']

  try {
    const result = await ordersService.confirmPayment(
      id,
      {userId: user.userId, roleName: user.roleName},
      ipAddress,
      userAgent
    )

    // Generate QR code
    const qrCodeUrl = await generateTicketQRCode(result.order.orderNumber, result.order.eventId)
    const ticketUrl = generateTicketUrl(result.order.orderNumber, result.accessToken)

    // Format date
    const eventDate = new Date(result.order.event.eventDate)
    const formattedDate = eventDate.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const formattedTime = eventDate.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    // Per-ticket units for multi-QR email
    let ticketUnits: Array<{
      ticketCode: string
      qrCodeUrl: string
      typeName: string
      seatNumber?: string
      price: number
      index: number
      attendeeName: string | null
      attendeeEmail: string | null
    }> = []
    let seatsList = result.order.orderItems
      .map(
        (item: any) =>
          `${item.seat?.seatNumber || item.seatNumber} (${item.seat?.seatType || item.seatType})`,
      )
      .join(', ')
    try {
      const {ensureTicketUnitsForOrder} = await import('../../utils/ticket-unit.js')
      const {query} = await import('../../db/mysql.js')
      const {humanizeSeatType, buildTicketLines, formatTicketLinesSummary} = await import(
        '../../utils/ticket-lines.js'
      )
      await ensureTicketUnitsForOrder(result.order.id)
      const rows = await query<{
        ticket_code: string
        qr_code_url: string
        seat_number: string
        seat_type: string
        price: number
        ticket_type_name: string | null
        attendee_name: string | null
        attendee_email: string | null
      }>(
        `SELECT oi.ticket_code, oi.qr_code_url, oi.seat_number, oi.seat_type, oi.price,
                COALESCE(tt.name, tt2.name) AS ticket_type_name,
                oi.attendee_name, oi.attendee_email
         FROM order_items oi
         LEFT JOIN seats s ON s.id = oi.seat_id
         LEFT JOIN ticket_types tt ON tt.id = s.ticket_type_id
         LEFT JOIN ticket_types tt2 ON tt2.id = oi.ticket_type_id
         WHERE oi.order_id = ?
         ORDER BY oi.created_at ASC`,
        [result.order.id],
      )
      ticketUnits = rows
        .filter((r) => r.ticket_code && r.qr_code_url)
        .map((r, i) => ({
          ticketCode: r.ticket_code,
          qrCodeUrl: r.qr_code_url,
          typeName:
            (r.ticket_type_name && String(r.ticket_type_name).trim()) ||
            humanizeSeatType(r.seat_type),
          seatNumber: r.seat_number,
          price: Number(r.price),
          index: i + 1,
          attendeeName: r.attendee_name,
          attendeeEmail: r.attendee_email,
        }))
      seatsList = formatTicketLinesSummary(
        buildTicketLines(
          result.order.orderItems.map((item: any) => ({
            seatNumber: item.seat?.seatNumber || item.seatNumber,
            seatType: item.seat?.seatType || item.seatType,
            price: item.price,
            ticketTypeId: item.seat?.ticketTypeId,
            ticketTypeName: item.seat?.ticketType?.name,
          })),
        ),
      )
    } catch (e) {
      console.warn('[CONFIRM] ticket units for email:', e)
    }

    // Send one confirmation email per ticket holder.
    //
    // Each ticket carries its own attendee, so the holder — not the person who
    // paid — is who needs the QR. Tickets are grouped by recipient address, so
    // someone holding several tickets gets one email containing all of theirs.
    // Tickets with no attendee email (older orders, or a holder left blank)
    // fall back to the buyer, which also preserves the previous behaviour for
    // orders placed before attendee details were collected.
    let emailStatus: 'SENT' | 'FAILED' = 'FAILED'
    let emailError: string | null = null
    let emailsSent = 0
    let emailsFailed = 0

    try {
      const totalFormatted = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(Number(result.order.totalAmount) || 0)
      const pdfUrl = ticketUrl
        .replace('/ticket/', '/api/ticket/')
        .replace('?token=', '/pdf?token=')

      const buyerEmail = result.order.customerEmail
      const buyerName = result.order.customerName

      type Recipient = {
        email: string
        name: string
        units: typeof ticketUnits
      }
      const byRecipient = new Map<string, Recipient>()

      for (const unit of ticketUnits) {
        const email = (unit.attendeeEmail || '').trim() || buyerEmail
        const key = email.toLowerCase()
        const existing = byRecipient.get(key)
        if (existing) {
          existing.units.push(unit)
        } else {
          byRecipient.set(key, {
            email,
            name: (unit.attendeeName || '').trim() || buyerName,
            units: [unit],
          })
        }
      }

      // No per-ticket units resolved (e.g. legacy order): fall back to a single
      // email to the buyer carrying the whole order, exactly as before.
      const recipients: Recipient[] =
        byRecipient.size > 0
          ? Array.from(byRecipient.values())
          : [{email: buyerEmail, name: buyerName, units: []}]

      for (const recipient of recipients) {
        // Re-number the units so each holder's email reads "Ticket 1..n".
        const units = recipient.units.map((u, i) => ({...u, index: i + 1}))
        const isWholeOrder = units.length === 0 || units.length === ticketUnits.length

        const emailResult = await sendEmailByPurpose({
          purpose: 'TICKET_CONFIRMED',
          to: recipient.email,
          orderId: result.order.id,
          triggeredBy: user.userId,
          templateId, // admin-selected template from Email Templates
          // Several recipients share this order and purpose; the 5-minute
          // anti-spam guard would drop everyone after the first without this.
          allowDuplicate: true,
          data: {
            customerName: recipient.name,
            eventName: result.order.event.name,
            eventDate: formattedDate,
            eventTime: formattedTime,
            eventVenue: result.order.event.venue,
            eventAddress: result.order.event.venue,
            orderNumber: result.order.orderNumber,
            seats: isWholeOrder
              ? seatsList
              : units.map((u) => u.typeName).join(', '),
            ticketUnits: units,
            ticketCount: units.length || result.order.orderItems.length,
            totalAmount: totalFormatted,
            qrCodeUrl,
            ticketUrl,
            pdfUrl,
          },
        })

        if (emailResult.success) {
          emailsSent++
          console.log(
            `📧 Confirmation email sent to ${recipient.email} (${units.length || 'all'} ticket(s))`
          )
        } else {
          emailsFailed++
          emailError = emailResult.error || 'Unknown error'
          console.error(
            `❌ Confirmation email failed for ${recipient.email}: ${emailError}`
          )
        }
      }

      // Treat the send as successful when at least one holder was reached;
      // any individual failure is still surfaced through emailError.
      emailStatus = emailsSent > 0 ? 'SENT' : 'FAILED'
    } catch (err: any) {
      emailError = err?.message || 'Unknown error'
      console.error('Failed to send confirmation email:', err)
    }

    // Send Telegram Notification
    try {
      const { notifyOrderConfirmed } = await import('../../services/telegram.service.js')
      await notifyOrderConfirmed({
        orderNumber: result.order.orderNumber,
        customerName: result.order.customerName,
        eventName: result.order.event.name,
        totalAmount: Number(result.order.totalAmount),
        seats: result.order.orderItems.map((item: any) => ({
          seatNumber: item.seat.seatNumber,
          seatType: item.seat.seatType,
        })),
      })
    } catch (telegramErr) {
      console.error('[TELEGRAM] Failed to send order confirmed notification:', telegramErr)
    }

    // One email goes to each ticket holder, so report how many landed.
    const message =
      emailStatus === 'SENT'
        ? emailsFailed > 0
          ? `Xác nhận thanh toán thành công. Đã gửi ${emailsSent} email, ${emailsFailed} email thất bại.`
          : `Xác nhận thanh toán thành công. Đã gửi ${emailsSent} email cho người tham dự.`
        : 'Xác nhận thanh toán thành công nhưng gửi email thất bại.'

    return reply.send({
      success: true,
      data: {
        orderId: result.updatedOrder.id,
        orderNumber: result.updatedOrder.orderNumber,
        status: result.updatedOrder.status,
        ticketUrl,
        emailStatus,
        emailError,
        emailsSent,
        emailsFailed,
        emailSentTo: result.order.customerEmail,
      },
      message,
    })
  } catch (error: any) {
    throw new BadRequestError(error.message)
  }
}

/**
 * POST /api/admin/orders/:id/reject
 */
export async function rejectPayment(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const {id} = request.params as {id: string}
  const {reason, notes} = request.body as {reason: string; notes?: string}
  const ipAddress = request.ip
  const userAgent = request.headers['user-agent']

  if (!reason) throw new BadRequestError('Reason is required')

  try {
    const result = await ordersService.rejectPayment(
      id,
      reason,
      {userId: user.userId, roleName: user.roleName},
      notes,
      ipAddress,
      userAgent
    )

    // Send rejection email (await so we can surface status to admin UI)
    let emailStatus: 'SENT' | 'FAILED' = 'FAILED'
    let emailError: string | null = null
    try {
      const emailResult = await sendEmailByPurpose({
        purpose: 'PAYMENT_REJECTED',
        to: result.order.customerEmail,
        orderId: result.order.id,
        triggeredBy: user.userId,
        data: {
          customerName: result.order.customerName,
          orderNumber: result.order.orderNumber,
          reason,
          eventName: result.order.event.name,
        },
      })
      if (emailResult.success) {
        emailStatus = 'SENT'
      } else {
        emailError = emailResult.error || 'Unknown error'
        console.error(`❌ Rejection email failed for ${result.order.customerEmail}: ${emailError}`)
      }
    } catch (err: any) {
      emailError = err?.message || 'Unknown error'
      console.error('Failed to send rejection email:', err)
    }

    return reply.send({
      success: true,
      data: {
        orderId: result.updatedOrder.id,
        orderNumber: result.updatedOrder.orderNumber,
        status: result.updatedOrder.status,
        releasedSeats: result.releasedSeats,
        emailStatus,
        emailError,
        emailSentTo: result.order.customerEmail,
      },
      message: 'Payment rejected',
    })
  } catch (error: any) {
    throw new BadRequestError(error.message)
  }
}

/**
 * POST /api/admin/orders/:id/resend-email
 */
export async function resendEmail(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const {id} = request.params as {id: string}
  const body = (request.body || {}) as {templateId?: string}

  try {
    const result = await ordersService.resendTicketEmail(
      id,
      {userId: user.userId, roleName: user.roleName},
      {templateId: body.templateId},
    )

    if (!result.emailResult.success) {
      throw new BadRequestError(`Failed to send email: ${result.emailResult.error}`)
    }

    return reply.send({
      success: true,
      data: {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        emailSentTo: result.order.customerEmail,
        emailId: result.emailResult.emailId,
      },
      message: 'Email đã gửi lại thành công. Link vé cũ sẽ không còn hiệu lực.',
    })
  } catch (error: any) {
    if (error instanceof BadRequestError) throw error
    throw new BadRequestError(error.message)
  }
}

/**
 * DELETE /api/admin/orders/:id
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const {id} = request.params as {id: string}
  const ipAddress = request.ip
  const userAgent = request.headers['user-agent']

  try {
    const result = await ordersService.deleteOrder(
      id,
      {userId: user.userId, roleName: user.roleName},
      ipAddress,
      userAgent
    )

    return reply.send({
      success: true,
      message: 'Order deleted successfully',
      data: result,
    })
  } catch (error: any) {
    if (error.message === 'Order not found') {
      throw new NotFoundError(error.message)
    }
    throw new BadRequestError(error.message)
  }
}
