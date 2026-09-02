/**
 * Checkout Store — SessionStorage-backed state for the 3-step purchase flow.
 *
 * Persists: purchased tickets, attendee info, event/order context across
 * pages. Cleared automatically after successful payment confirmation.
 */

const STORAGE_KEY = 'tedx_checkout_state'

export interface AttendeeInfo {
  /** order_items.id — identifies which ticket this attendee holds. */
  orderItemId: string
  /** Display label for the form header, e.g. "VIP". */
  ticketTypeName: string
  name: string
  email: string
  phone: string
}

/**
 * Deliberately loose: this is a "did they actually type an address" check, not
 * an attempt to decide deliverability. Anything stricter starts rejecting
 * valid addresses, and the real test is whether the ticket email arrives.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Blank, or nothing but whitespace — `!value` alone lets " " through. */
function blank(value: string | undefined | null): boolean {
  return !value || !value.trim()
}

export interface ContactInfo {
  name: string
  email: string
  phone: string
}

/**
 * Everything still missing before an order may claim payment.
 *
 * Each ticket carries its own holder and each holder is emailed their own QR,
 * so a blank attendee row is not a cosmetic gap — that person has no way in.
 * Returns human-readable reasons, empty when the order is complete.
 */
export function findMissingCheckoutInfo(
  billing: ContactInfo,
  attendees: AttendeeInfo[],
  expectedAttendees?: number,
): string[] {
  const missing: string[] = []

  if (blank(billing.name)) missing.push('Billing name')
  if (blank(billing.email)) missing.push('Billing email')
  else if (!EMAIL_RE.test(billing.email.trim())) missing.push('A valid billing email')
  if (blank(billing.phone)) missing.push('Billing phone')

  // A missing row is as invalid as a blank one: no holder, no ticket email.
  if (expectedAttendees !== undefined && attendees.length < expectedAttendees) {
    missing.push(
      `Details for all ${expectedAttendees} ticket holders (${attendees.length} filled in)`,
    )
  }

  attendees.forEach((a, i) => {
    const who = a.ticketTypeName ? `${a.ticketTypeName} ticket ${i + 1}` : `Ticket ${i + 1}`
    if (blank(a.name)) missing.push(`${who}: holder name`)
    if (blank(a.email)) missing.push(`${who}: holder email`)
    else if (!EMAIL_RE.test(a.email.trim())) missing.push(`${who}: a valid holder email`)
    if (blank(a.phone)) missing.push(`${who}: holder phone`)
  })

  return missing
}

/** One purchased ticket. The venue has no seat map — organisers seat people afterwards. */
export interface PurchasedTicket {
  /** order_items.id */
  id: string
  ticketTypeId: string
  ticketTypeName: string
  price: number
  /** Hex colour assigned to this ticket type in the admin, e.g. "#10b981". */
  color?: string | null
}

export interface CheckoutState {
  eventId: string
  eventName: string
  eventDate: string
  orderNumber: string
  accessToken: string
  tickets: PurchasedTicket[]
  attendees: AttendeeInfo[]
  /**
   * Promotion applied at ticket selection.
   *
   * The order's stored total is already net of it, so without carrying the
   * parts a later step can only add ticket prices up and show a figure that
   * silently disagrees with what the buyer was quoted. Optional: orders
   * placed before this existed carry no promo.
   */
  subtotal?: number
  discountAmount?: number
  promoCode?: string | null
}

/** Save checkout state to sessionStorage */
export function saveCheckoutState(state: CheckoutState): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('[CHECKOUT STORE] Failed to save state:', err)
  }
}

/** Load checkout state from sessionStorage (returns null if missing/invalid) */
export function loadCheckoutState(): CheckoutState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CheckoutState
  } catch (err) {
    console.error('[CHECKOUT STORE] Failed to load state:', err)
    return null
  }
}

/** Clear checkout state from sessionStorage */
export function clearCheckoutState(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Update only the attendees portion of the state */
export function saveAttendees(attendees: AttendeeInfo[]): void {
  const state = loadCheckoutState()
  if (!state) return
  state.attendees = attendees
  saveCheckoutState(state)
}
