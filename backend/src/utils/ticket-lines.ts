/**
 * Group order items into inventory ticket lines (type × qty).
 * Used by ticket API, email, admin resend — seat-map still has raw seats.
 */

export type RawOrderItem = {
  seatNumber?: string | null
  seat_number?: string | null
  seatType?: string | null
  seat_type?: string | null
  price: number | string
  ticketTypeId?: string | null
  ticket_type_id?: string | null
  ticketTypeName?: string | null
  ticket_type_name?: string | null
  seat?: {
    ticketTypeId?: string | null
    ticketType?: {name?: string | null} | null
  } | null
}

export type TicketLine = {
  ticketTypeId: string | null
  name: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export function humanizeSeatType(seatType: string | null | undefined): string {
  const s = String(seatType || '').toUpperCase()
  if (!s) return 'Ticket'
  if (s.includes('VIP')) return 'VIP'
  if (s.includes('DONOR')) return 'Donor'
  if (s.includes('ECONOMY') || s.includes('EARLY')) return 'Early Bird'
  if (s.includes('STANDARD') || s.includes('LEVEL_2')) return 'Standard'
  if (s.startsWith('LEVEL_')) return s.replace('LEVEL_', 'Level ')
  return s
}

export function buildTicketLines(items: RawOrderItem[]): TicketLine[] {
  const map = new Map<string, TicketLine>()
  for (const item of items) {
    const unitPrice = Number(item.price) || 0
    const ticketTypeId =
      item.ticketTypeId ||
      item.ticket_type_id ||
      item.seat?.ticketTypeId ||
      null
    const name =
      (item.ticketTypeName && String(item.ticketTypeName).trim()) ||
      (item.ticket_type_name && String(item.ticket_type_name).trim()) ||
      (item.seat?.ticketType?.name && String(item.seat.ticketType.name).trim()) ||
      humanizeSeatType(item.seatType || item.seat_type)
    const key = `${ticketTypeId || 'none'}|${name}|${unitPrice}`
    const cur = map.get(key)
    if (cur) {
      cur.quantity += 1
      cur.lineTotal += unitPrice
    } else {
      map.set(key, {
        ticketTypeId,
        name,
        unitPrice,
        quantity: 1,
        lineTotal: unitPrice,
      })
    }
  }
  return Array.from(map.values())
}

/** Plain text for templates that only accept string: "Early Bird × 2, Standard × 1" */
export function formatTicketLinesSummary(lines: TicketLine[]): string {
  if (!lines.length) return ''
  return lines.map((l) => `${l.name} × ${l.quantity}`).join(', ')
}

/** HTML rows for email inventory table */
export function ticketLinesToHtmlRows(lines: TicketLine[], formatMoney: (n: number) => string): string {
  return lines
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;font-weight:700;color:#000;">${escapeHtml(l.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;color:#000;">${l.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;color:#333;">${formatMoney(l.unitPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;font-weight:800;text-align:right;color:#000;">${formatMoney(l.lineTotal)}</td>
      </tr>`,
    )
    .join('')
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
