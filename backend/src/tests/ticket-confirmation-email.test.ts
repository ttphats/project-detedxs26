import {describe, it, expect, vi, beforeEach} from 'vitest'

const sendEmailByPurpose = vi.fn()

vi.mock('../config/env.js', () => ({
  config: {
    jwt: {secret: 'test-secret-at-least-32-characters-long'},
    clientUrl: 'https://tedx.example',
    cloudinary: {url: undefined, folder: undefined},
  },
}))
vi.mock('../services/email.service.js', () => ({sendEmailByPurpose}))
vi.mock('../db/mysql.js', () => ({query: vi.fn(), execute: vi.fn()}))
vi.mock('../utils/ticket-unit.js', () => ({ensureTicketUnitsForOrder: vi.fn()}))

const {sendTicketConfirmationEmails} = await import(
  '../services/ticket-confirmation-email.service.js'
)
const {generateHolderToken} = await import('../utils/holder-token.js')

const ORDER_NUMBER = 'TKHABC123'

const order = {
  id: 'order-1',
  orderNumber: ORDER_NUMBER,
  customerName: 'Buyer',
  customerEmail: 'buyer@example.com',
  totalAmount: 300000,
}
const event = {name: 'TEDx', venue: 'Hall', eventDate: '2026-09-01T12:00:00Z'}

function unit(index: number, attendee: {name: string; email: string} | null) {
  return {
    ticketCode: `TKT-000${index}`,
    qrCodeUrl: `https://cdn.example/qr${index}.png`,
    typeName: 'Standard',
    price: 100000,
    index,
    attendeeName: attendee?.name ?? null,
    attendeeEmail: attendee?.email ?? null,
  }
}

function send(ticketUnits: ReturnType<typeof unit>[]) {
  return sendTicketConfirmationEmails({
    order,
    event,
    accessToken: 'order-token',
    ticketUnits,
    seatsSummary: 'Standard × 3',
    orderItemCount: ticketUnits.length || 3,
    triggeredBy: 'admin-1',
  })
}

/** The `to` addresses of every email sent, in call order. */
function sentTo() {
  return sendEmailByPurpose.mock.calls.map((c) => c[0].to)
}
function callFor(email: string) {
  return sendEmailByPurpose.mock.calls.find((c) => c[0].to === email)?.[0]
}

describe('ticket confirmation emails', () => {
  beforeEach(() => {
    sendEmailByPurpose.mockReset()
    sendEmailByPurpose.mockResolvedValue({success: true})
  })

  it('sends one email per holder', async () => {
    const result = await send([
      unit(1, {name: 'Ann', email: 'ann@example.com'}),
      unit(2, {name: 'Bo', email: 'bo@example.com'}),
      unit(3, {name: 'Buyer', email: 'buyer@example.com'}),
    ])

    expect(result.sent).toBe(3)
    expect(sentTo().sort()).toEqual(['ann@example.com', 'bo@example.com', 'buyer@example.com'])
  })

  it('bundles a holder with several tickets into one email', async () => {
    await send([
      unit(1, {name: 'Ann', email: 'ann@example.com'}),
      unit(2, {name: 'Ann', email: 'ann@example.com'}),
      unit(3, {name: 'Buyer', email: 'buyer@example.com'}),
    ])

    expect(sentTo()).toHaveLength(2)
    const ann = callFor('ann@example.com')!
    expect(ann.data.ticketUnits).toHaveLength(2)
    // Re-numbered so her email reads "Ticket 1" and "Ticket 2".
    expect(ann.data.ticketUnits.map((u: any) => u.index)).toEqual([1, 2])
  })

  it('gives each holder a link scoped to their own tickets', async () => {
    await send([
      unit(1, {name: 'Ann', email: 'ann@example.com'}),
      unit(2, {name: 'Buyer', email: 'buyer@example.com'}),
    ])

    const annToken = generateHolderToken(ORDER_NUMBER, 'ann@example.com')
    const ann = callFor('ann@example.com')!
    expect(ann.data.ticketUrl).toContain(`token=${annToken}`)
    expect(ann.data.ticketUrl).not.toContain('order-token')
    expect(ann.data.pdfUrl).toBeUndefined()
  })

  it('gives a scoped holder a QR that checks them in', async () => {
    // Templates have one {{qrCodeUrl}} slot; a holder must not get the
    // order-level QR there, and must not get an empty one either.
    await send([
      unit(1, {name: 'Ann', email: 'ann@example.com'}),
      unit(2, {name: 'Buyer', email: 'buyer@example.com'}),
    ])

    expect(callFor('ann@example.com')!.data.qrCodeUrl).toBe('https://cdn.example/qr1.png')
  })

  it('gives the buyer the order token, which opens everything they paid for', async () => {
    await send([
      unit(1, {name: 'Ann', email: 'ann@example.com'}),
      unit(2, {name: 'Buyer', email: 'buyer@example.com'}),
    ])

    expect(callFor('buyer@example.com')!.data.ticketUrl).toContain('token=order-token')
  })

  it('still emails the buyer when every ticket belongs to someone else', async () => {
    await send([
      unit(1, {name: 'Ann', email: 'ann@example.com'}),
      unit(2, {name: 'Bo', email: 'bo@example.com'}),
    ])

    const buyer = callFor('buyer@example.com')
    expect(buyer).toBeDefined()
    // The buyer's copy covers the whole order.
    expect(buyer!.data.ticketUnits).toHaveLength(2)
    expect(buyer!.data.seats).toBe('Standard × 3')
  })

  it('falls back to the buyer for tickets with no holder email', async () => {
    await send([unit(1, null), unit(2, null)])

    expect(sentTo()).toEqual(['buyer@example.com'])
    expect(callFor('buyer@example.com')!.data.ticketUnits).toHaveLength(2)
  })

  it('sends one whole-order email when no ticket units resolved', async () => {
    const result = await send([])

    expect(sentTo()).toEqual(['buyer@example.com'])
    const call = callFor('buyer@example.com')!
    expect(call.data.ticketCount).toBe(3)
    expect(call.data.seats).toBe('Standard × 3')
  })

  it('treats holder emails case-insensitively', async () => {
    await send([
      unit(1, {name: 'Ann', email: 'Ann@Example.com'}),
      unit(2, {name: 'Ann', email: 'ann@example.com'}),
      unit(3, {name: 'Buyer', email: 'buyer@example.com'}),
    ])

    expect(sentTo()).toHaveLength(2)
    expect(callFor('Ann@Example.com')!.data.ticketUnits).toHaveLength(2)
  })

  it('bypasses the anti-spam guard so later holders are not dropped', async () => {
    await send([
      unit(1, {name: 'Ann', email: 'ann@example.com'}),
      unit(2, {name: 'Bo', email: 'bo@example.com'}),
    ])

    for (const [options] of sendEmailByPurpose.mock.calls) {
      expect(options.allowDuplicate).toBe(true)
    }
  })

  it('reports partial failure without losing the other recipients', async () => {
    sendEmailByPurpose.mockImplementation(async (o: any) =>
      o.to === 'bo@example.com' ? {success: false, error: 'mailbox full'} : {success: true}
    )

    const result = await send([
      unit(1, {name: 'Ann', email: 'ann@example.com'}),
      unit(2, {name: 'Bo', email: 'bo@example.com'}),
      unit(3, {name: 'Buyer', email: 'buyer@example.com'}),
    ])

    expect(result.sent).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.error).toBe('mailbox full')
    expect(result.recipients.find((r) => r.email === 'bo@example.com')!.success).toBe(false)
  })
})
