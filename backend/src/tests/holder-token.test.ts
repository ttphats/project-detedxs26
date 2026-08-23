import {describe, it, expect, vi} from 'vitest'

vi.mock('../config/env.js', () => ({
  config: {jwt: {secret: 'test-secret-at-least-32-characters-long'}},
}))

const {
  generateHolderToken,
  isHolderToken,
  normalizeHolderEmail,
  resolveHolderEmail,
} = await import('../utils/holder-token.js')

const ORDER = 'TKHABC123'

describe('holder tokens', () => {
  it('is stable for the same order and holder', () => {
    expect(generateHolderToken(ORDER, 'a@example.com')).toBe(
      generateHolderToken(ORDER, 'a@example.com'),
    )
  })

  it('ignores case and surrounding whitespace in the email', () => {
    expect(generateHolderToken(ORDER, '  A@Example.COM ')).toBe(
      generateHolderToken(ORDER, 'a@example.com'),
    )
  })

  it('differs per holder and per order', () => {
    const a = generateHolderToken(ORDER, 'a@example.com')
    expect(a).not.toBe(generateHolderToken(ORDER, 'b@example.com'))
    expect(a).not.toBe(generateHolderToken('TKHZZZ999', 'a@example.com'))
  })

  it('is distinguishable from an order access token', () => {
    // Order tokens are 64 plain hex characters with no prefix.
    expect(isHolderToken('a'.repeat(64))).toBe(false)
    expect(isHolderToken(generateHolderToken(ORDER, 'a@example.com'))).toBe(true)
    expect(isHolderToken(undefined)).toBe(false)
  })

  it('resolves to the holder it was issued for', () => {
    const token = generateHolderToken(ORDER, 'b@example.com')
    expect(
      resolveHolderEmail(ORDER, token, ['a@example.com', 'B@example.com', null]),
    ).toBe('b@example.com')
  })

  it('refuses a token issued for a different order', () => {
    const token = generateHolderToken('TKHOTHER1', 'a@example.com')
    expect(resolveHolderEmail(ORDER, token, ['a@example.com'])).toBeNull()
  })

  it('refuses a holder not on this order', () => {
    const token = generateHolderToken(ORDER, 'stranger@example.com')
    expect(resolveHolderEmail(ORDER, token, ['a@example.com'])).toBeNull()
  })

  it('refuses a forged or truncated token', () => {
    const token = generateHolderToken(ORDER, 'a@example.com')
    expect(resolveHolderEmail(ORDER, token.slice(0, -1), ['a@example.com'])).toBeNull()
    expect(resolveHolderEmail(ORDER, 'h_' + '0'.repeat(32), ['a@example.com'])).toBeNull()
  })

  it('never resolves an order-style token', () => {
    expect(resolveHolderEmail(ORDER, 'f'.repeat(64), ['a@example.com'])).toBeNull()
  })

  it('normalizes blank values to an empty string', () => {
    expect(normalizeHolderEmail('')).toBe('')
    expect(normalizeHolderEmail('  ')).toBe('')
  })
})
