/**
 * How much of each ticket type's `max_quantity` has been taken.
 *
 * `ticket_types.sold_quantity` is a leftover counter that nothing writes, so
 * usage is counted from the order items themselves. This is the single
 * definition of "used" shared by the admin list, the public availability
 * endpoints and the order-creation check — if they disagreed, a type could
 * read as available on the ticket page and then be refused at checkout.
 */
import {query} from '../db/mysql.js'

export interface TicketTypeUsage {
  /** Tickets on PAID orders. */
  paid: number
  /**
   * Tickets not sold but not free either: a buyer waiting for an admin to
   * confirm their transfer, or one whose checkout window is still open. An
   * expired PENDING order holds nothing and is excluded.
   */
  held: number
  /** paid + held — what counts against `max_quantity`. */
  used: number
}

export const EMPTY_USAGE: TicketTypeUsage = {paid: 0, held: 0, used: 0}

/**
 * Usage per ticket type id, for one event or all of them.
 *
 * A ticket reaches its type either directly through
 * `order_items.ticket_type_id` (ticket-class flow) or through the seat it was
 * assigned (seat-map flow), so both are counted.
 */
export async function getTicketTypeUsage(
  eventId?: string,
): Promise<Map<string, TicketTypeUsage>> {
  const params: any[] = []
  let scope = ''
  if (eventId) {
    scope = 'AND o.event_id = ?'
    params.push(eventId)
  }

  const rows = await query<{
    ticket_type_id: string | null
    paid: number | null
    held: number | null
  }>(
    `SELECT COALESCE(oi.ticket_type_id, s.ticket_type_id) AS ticket_type_id,
            SUM(o.status = 'PAID') AS paid,
            SUM(
              o.status = 'PENDING_CONFIRMATION'
              OR (o.status = 'PENDING' AND o.expires_at > NOW())
            ) AS held
     FROM order_items oi
     LEFT JOIN seats s ON s.id = oi.seat_id
     JOIN orders o ON o.id = oi.order_id
     WHERE COALESCE(oi.ticket_type_id, s.ticket_type_id) IS NOT NULL
     ${scope}
     GROUP BY COALESCE(oi.ticket_type_id, s.ticket_type_id)`,
    params,
  )

  const usage = new Map<string, TicketTypeUsage>()
  for (const row of rows) {
    if (!row.ticket_type_id) continue
    const paid = Number(row.paid) || 0
    const held = Number(row.held) || 0
    usage.set(row.ticket_type_id, {paid, held, used: paid + held})
  }
  return usage
}

/**
 * Tickets still sellable under a type's cap.
 *
 * Returns null when the type has no cap. Never negative: a type can go over
 * its cap (nothing enforced it historically), and that should read as zero
 * left rather than as negative stock.
 */
export function remainingUnderCap(
  maxQuantity: number | null | undefined,
  usage: TicketTypeUsage | undefined,
): number | null {
  if (maxQuantity == null || !Number.isFinite(Number(maxQuantity))) return null
  return Math.max(0, Number(maxQuantity) - (usage?.used ?? 0))
}
