/**
 * What makes an order valid enough to claim payment.
 *
 * The browser gates the "I Have Paid" button on the same rules, but this
 * endpoint is reachable directly, so the decision has to live here too. An
 * order with gaps is treated as invalid rather than accepted and cleaned up
 * later: every ticket carries its own holder, and each holder is emailed
 * their own QR, so a blank holder row means that person has no way in.
 *
 * Mirrors findMissingCheckoutInfo() in web-client/src/lib/checkout-store.ts.
 */

/**
 * Deliberately loose: a "did they actually type an address" check, not an
 * attempt to decide deliverability. Anything stricter starts rejecting valid
 * addresses, and the real test is whether the ticket email arrives.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Blank, or nothing but whitespace — `!value` alone lets " " through. */
function blank(value: string | undefined | null): boolean {
  return !value || !String(value).trim()
}

export interface OrderContact {
  name?: string
  email?: string
  phone?: string
}

export interface OrderAttendee {
  orderItemId?: string
  name?: string
  email?: string
  phone?: string
}

/**
 * Human-readable reasons the order is incomplete; empty when it is fine.
 *
 * `expectedAttendees`, when given, also rejects an order that simply omitted
 * holders rather than sending blank ones.
 */
export function findMissingOrderInfo(
  billing: OrderContact,
  attendees: OrderAttendee[],
  expectedAttendees?: number
): string[] {
  const missing: string[] = []

  if (blank(billing.name)) missing.push('billing name')
  if (blank(billing.email)) missing.push('billing email')
  else if (!EMAIL_RE.test(billing.email!.trim())) missing.push('a valid billing email')
  if (blank(billing.phone)) missing.push('billing phone')

  if (expectedAttendees !== undefined && attendees.length < expectedAttendees) {
    missing.push(
      `details for all ${expectedAttendees} ticket holders (${attendees.length} provided)`
    )
  }

  attendees.forEach((a, i) => {
    const who = `ticket ${i + 1}`
    if (blank(a.name)) missing.push(`${who}: holder name`)
    if (blank(a.email)) missing.push(`${who}: holder email`)
    else if (!EMAIL_RE.test(a.email!.trim())) missing.push(`${who}: a valid holder email`)
    if (blank(a.phone)) missing.push(`${who}: holder phone`)
  })

  return missing
}
