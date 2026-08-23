/**
 * Ticket confirmation emails, addressed per ticket holder.
 *
 * Each ticket carries its own attendee, so the holder — not whoever paid — is
 * who needs the QR. Tickets are grouped by recipient address, so a holder with
 * several tickets gets one email containing all of theirs. Tickets with no
 * attendee email (orders placed before attendee details were collected, or a
 * holder left blank) fall back to the buyer, which preserves the old
 * single-email behaviour for those orders.
 *
 * Shared by admin confirm and admin resend so the two cannot drift apart.
 */
import {sendEmailByPurpose} from './email.service.js'
import {generateTicketUrl} from './qrcode.service.js'
import {generateHolderToken, normalizeHolderEmail} from '../utils/holder-token.js'
import {humanizeSeatType} from '../utils/ticket-lines.js'
import {ensureTicketUnitsForOrder} from '../utils/ticket-unit.js'
import {query} from '../db/mysql.js'

export interface ConfirmationTicketUnit {
  ticketCode: string
  qrCodeUrl: string
  typeName: string
  seatNumber?: string
  price: number
  index: number
  attendeeName: string | null
  attendeeEmail: string | null
}

/**
 * Load the per-ticket units of an order, with the holder attached.
 *
 * Ticket type is resolved through the seat for seat-map orders and through
 * `order_items.ticket_type_id` for ticket-class ones, so neither flow ends up
 * with unnamed tickets.
 */
export async function loadTicketUnitsForOrder(
  orderId: string,
): Promise<ConfirmationTicketUnit[]> {
  await ensureTicketUnitsForOrder(orderId)

  const rows = await query<{
    ticket_code: string
    qr_code_url: string
    seat_number: string | null
    seat_type: string | null
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
    [orderId],
  )

  return rows
    .filter((r) => r.ticket_code && r.qr_code_url)
    .map((r, i) => ({
      ticketCode: r.ticket_code,
      qrCodeUrl: r.qr_code_url,
      typeName:
        (r.ticket_type_name && String(r.ticket_type_name).trim()) ||
        humanizeSeatType(r.seat_type),
      seatNumber: r.seat_number ?? undefined,
      price: Number(r.price),
      index: i + 1,
      attendeeName: r.attendee_name,
      attendeeEmail: r.attendee_email,
    }))
}

export interface SendConfirmationEmailsParams {
  order: {
    id: string
    orderNumber: string
    customerName: string
    customerEmail: string
    totalAmount: number
  }
  event: {name: string; venue: string; eventDate: Date | string}
  /** The order-level token. Only the buyer's email is given this. */
  accessToken: string
  ticketUnits: ConfirmationTicketUnit[]
  /** Human-readable summary of the whole order, e.g. "VIP × 2, Standard × 1". */
  seatsSummary: string
  /** Inventory lines for templates that render them. */
  ticketLines?: unknown
  /**
   * Item count on the order, used for the whole-order email when no per-ticket
   * units could be resolved (legacy orders without ticket codes).
   */
  orderItemCount: number
  /** Order-level QR, shown only on the buyer's whole-order email. */
  qrCodeUrl?: string
  /** Admin-selected template from Email Templates. */
  templateId?: string
  triggeredBy: string
}

export interface SendConfirmationEmailsResult {
  sent: number
  failed: number
  /** Last failure seen, for surfacing in the admin UI. */
  error: string | null
  recipients: Array<{email: string; ticketCount: number; success: boolean}>
}

interface Recipient {
  email: string
  name: string
  units: ConfirmationTicketUnit[]
}

/** Group tickets by the address they should be sent to. */
function groupByRecipient(
  ticketUnits: ConfirmationTicketUnit[],
  buyerEmail: string,
  buyerName: string,
): Recipient[] {
  const byRecipient = new Map<string, Recipient>()

  for (const unit of ticketUnits) {
    const email = (unit.attendeeEmail || '').trim() || buyerEmail
    const key = normalizeHolderEmail(email)
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

  // No per-ticket units resolved (e.g. a legacy order whose items never got
  // ticket codes): fall back to one email to the buyer carrying the whole
  // order, exactly as before.
  if (byRecipient.size === 0) {
    return [{email: buyerEmail, name: buyerName, units: []}]
  }

  // A buyer who named other people for every ticket holds none themselves, and
  // would otherwise get no confirmation that the payment they made went
  // through. Give them the whole-order copy.
  if (!byRecipient.has(normalizeHolderEmail(buyerEmail))) {
    byRecipient.set(normalizeHolderEmail(buyerEmail), {
      email: buyerEmail,
      name: buyerName,
      units: ticketUnits,
    })
  }

  return Array.from(byRecipient.values())
}

export async function sendTicketConfirmationEmails(
  params: SendConfirmationEmailsParams,
): Promise<SendConfirmationEmailsResult> {
  const {order, event, accessToken, ticketUnits, seatsSummary, ticketLines, templateId, triggeredBy} =
    params

  const eventDate = new Date(event.eventDate)
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
  const totalFormatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(order.totalAmount) || 0)

  const buyerEmail = order.customerEmail
  const buyerKey = normalizeHolderEmail(buyerEmail)
  const recipients = groupByRecipient(ticketUnits, buyerEmail, order.customerName)

  const result: SendConfirmationEmailsResult = {
    sent: 0,
    failed: 0,
    error: null,
    recipients: [],
  }

  for (const recipient of recipients) {
    // Re-number so each holder's email reads "Ticket 1..n".
    const units = recipient.units.map((u, i) => ({...u, index: i + 1}))
    const isBuyer = normalizeHolderEmail(recipient.email) === buyerKey
    const isWholeOrder = units.length === 0 || units.length === ticketUnits.length

    // The buyer gets the order token, which opens every ticket they paid for.
    // Everyone else gets a token scoped to their own address, so a stranger on
    // the same order cannot view or download their tickets.
    const recipientToken = isBuyer
      ? accessToken
      : generateHolderToken(order.orderNumber, recipient.email)
    const recipientTicketUrl = generateTicketUrl(order.orderNumber, recipientToken)
    const recipientPdfUrl = recipientTicketUrl
      .replace('/ticket/', '/api/ticket/')
      .replace('?token=', '/pdf?token=')

    const emailResult = await sendEmailByPurpose({
      purpose: 'TICKET_CONFIRMED',
      to: recipient.email,
      orderId: order.id,
      triggeredBy,
      templateId,
      // Several recipients share this order and purpose; the 5-minute
      // anti-spam guard would drop everyone after the first without this.
      allowDuplicate: true,
      data: {
        customerName: recipient.name,
        eventName: event.name,
        eventDate: formattedDate,
        eventTime: formattedTime,
        eventVenue: event.venue,
        eventAddress: event.venue,
        orderNumber: order.orderNumber,
        seats: isWholeOrder ? seatsSummary : units.map((u) => u.typeName).join(', '),
        ...(isWholeOrder && ticketLines ? {ticketLines} : {}),
        ticketUnits: units,
        ticketCount: units.length || params.orderItemCount,
        totalAmount: totalFormatted,
        // Templates have a single {{qrCodeUrl}} slot. The order-level QR
        // belongs there only on a whole-order email; a scoped holder gets
        // their own first ticket's QR, so the code in their email is one that
        // actually checks them in. Templates that also render
        // {{ticketUnitsHtml}} show every one of their tickets.
        qrCodeUrl: isWholeOrder ? params.qrCodeUrl : units[0]?.qrCodeUrl || params.qrCodeUrl,
        ticketUrl: recipientTicketUrl,
        pdfUrl: recipientPdfUrl,
      },
    })

    if (emailResult.success) {
      result.sent++
      console.log(
        `📧 Confirmation email sent to ${recipient.email} (${units.length || 'all'} ticket(s))`,
      )
    } else {
      result.failed++
      result.error = emailResult.error || 'Unknown error'
      console.error(`❌ Confirmation email failed for ${recipient.email}: ${result.error}`)
    }

    result.recipients.push({
      email: recipient.email,
      ticketCount: units.length,
      success: emailResult.success,
    })
  }

  return result
}
