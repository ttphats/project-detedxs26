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

    // Tickets are identified by type — seating is arranged by the
    // organisers after purchase.
    const ticketsList = result.order.orderItems
      .map((item: any) => item.ticketTypeName || '')
      .filter(Boolean)
      .join(', ')

    // Fan out one ticket email per attendee (each with their own QR),
    // then send the buyer an order-level summary.
    let attendeeEmails: ordersService.AttendeeEmailOutcome[] = []
    try {
      attendeeEmails = await ordersService.sendAttendeeTicketEmails({
        orderId: result.order.id,
        triggeredBy: user.userId,
      })
    } catch (err: any) {
      console.error('Failed to send attendee ticket emails:', err)
    }

    let emailStatus: 'SENT' | 'FAILED' = 'FAILED'
    let emailError: string | null = null

    try {
      const emailResult = await sendEmailByPurpose({
        purpose: 'TICKET_CONFIRMED',
        to: result.order.customerEmail,
        orderId: result.order.id,
        triggeredBy: user.userId,
        // Per-attendee sends above already used this order+purpose within
        // the anti-spam window, so the buyer summary must opt out of it too.
        allowDuplicate: true,
        data: {
          customerName: result.order.customerName,
          eventName: result.order.event.name,
          eventDate: formattedDate,
          eventTime: formattedTime,
          eventVenue: result.order.event.venue,
          eventAddress: result.order.event.venue,
          orderNumber: result.order.orderNumber,
          tickets: ticketsList,
          totalAmount: Number(result.order.totalAmount),
          qrCodeUrl,
          ticketUrl,
        },
      })
      if (emailResult.success) {
        emailStatus = 'SENT'
        console.log(`📧 Order summary sent to buyer ${result.order.customerEmail}`)
      } else {
        emailError = emailResult.error || 'Unknown error'
        console.error(
          `❌ Buyer summary failed for ${result.order.customerEmail}: ${emailError}`
        )
      }
    } catch (err: any) {
      emailError = err?.message || 'Unknown error'
      console.error('Failed to send buyer summary email:', err)
    }

    const attendeesSent = attendeeEmails.filter((a) => a.status === 'SENT').length
    const attendeesFailed = attendeeEmails.length - attendeesSent

    const message =
      attendeesFailed === 0
        ? `Xác nhận thanh toán thành công. Đã gửi ${attendeesSent} vé qua email.`
        : `Xác nhận thanh toán thành công. Gửi ${attendeesSent}/${attendeeEmails.length} vé thành công, ${attendeesFailed} thất bại.`

    return reply.send({
      success: true,
      data: {
        orderId: result.updatedOrder.id,
        orderNumber: result.updatedOrder.orderNumber,
        status: result.updatedOrder.status,
        ticketUrl,
        emailStatus,
        emailError,
        emailSentTo: result.order.customerEmail,
        attendeeEmails,
        attendeesSent,
        attendeesFailed,
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

  try {
    const result = await ordersService.resendTicketEmail(id, {
      userId: user.userId,
      roleName: user.roleName,
    })

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
