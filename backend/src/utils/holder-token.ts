/**
 * Per-holder ticket access tokens.
 *
 * An order's `access_token` unlocks every ticket on that order. That is right
 * for the buyer, but a buyer may purchase for people who are strangers to each
 * other — mailing all of them the order token would let each one view and
 * download everybody else's ticket.
 *
 * A holder token unlocks only the tickets whose `attendee_email` matches. It is
 * derived rather than stored: an HMAC over the order number and the holder's
 * email, keyed with the server's JWT secret. That means no schema change and no
 * extra state to keep in sync, and the same holder always resolves to the same
 * permanent link (matching how the order token behaves).
 *
 * The `h_` prefix keeps them cheap to tell apart from order tokens, so the
 * normal buyer path never computes an HMAC.
 */
import crypto from 'crypto'
import {config} from '../config/env.js'

const HOLDER_TOKEN_PREFIX = 'h_'
/** 32 hex chars = 128 bits of the HMAC, far beyond guessing range. */
const HOLDER_TOKEN_LENGTH = 32

/** Holder emails are matched case-insensitively, as mail servers do. */
export function normalizeHolderEmail(email: string): string {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export function generateHolderToken(orderNumber: string, email: string): string {
  const digest = crypto
    .createHmac('sha256', config.jwt.secret)
    .update(`ticket-holder:${orderNumber}:${normalizeHolderEmail(email)}`)
    .digest('hex')
  return `${HOLDER_TOKEN_PREFIX}${digest.slice(0, HOLDER_TOKEN_LENGTH)}`
}

export function isHolderToken(token: string | undefined | null): boolean {
  return typeof token === 'string' && token.startsWith(HOLDER_TOKEN_PREFIX)
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Resolve a holder token against the attendee emails on an order.
 *
 * Returns the normalized email the token belongs to, or null if it matches
 * none of them. Callers use the result to filter the order down to that
 * holder's own tickets.
 */
export function resolveHolderEmail(
  orderNumber: string,
  token: string,
  candidateEmails: Array<string | null | undefined>,
): string | null {
  if (!isHolderToken(token)) return null

  const seen = new Set<string>()
  for (const candidate of candidateEmails) {
    const email = normalizeHolderEmail(candidate || '')
    if (!email || seen.has(email)) continue
    seen.add(email)
    if (safeEquals(generateHolderToken(orderNumber, email), token)) return email
  }
  return null
}
