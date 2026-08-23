import {describe, it, expect, vi, beforeEach} from 'vitest'

const query = vi.fn()
vi.mock('../db/mysql.js', () => ({query, execute: vi.fn(), queryOne: vi.fn()}))

const {getTicketTypeUsage, remainingUnderCap, EMPTY_USAGE} = await import(
  '../services/ticket-quota.service.js'
)

describe('remainingUnderCap', () => {
  it('treats a type with no cap as unlimited', () => {
    expect(remainingUnderCap(null, {paid: 99, held: 5, used: 104})).toBeNull()
    expect(remainingUnderCap(undefined, EMPTY_USAGE)).toBeNull()
  })

  it('subtracts both sold and held tickets from the cap', () => {
    expect(remainingUnderCap(30, {paid: 5, held: 12, used: 17})).toBe(13)
  })

  it('reports zero left once the cap is reached', () => {
    expect(remainingUnderCap(60, {paid: 60, held: 0, used: 60})).toBe(0)
  })

  it('never reports negative stock when a type is already over its cap', () => {
    // Nothing enforced the cap historically, so existing types can exceed it.
    expect(remainingUnderCap(54, {paid: 60, held: 9, used: 69})).toBe(0)
  })

  it('counts a type with no orders as fully available', () => {
    expect(remainingUnderCap(20, undefined)).toBe(20)
  })
})

describe('getTicketTypeUsage', () => {
  beforeEach(() => {
    query.mockReset()
  })

  it('sums paid and held into used, keyed by ticket type', async () => {
    query.mockResolvedValue([
      {ticket_type_id: 'vip', paid: 5, held: 12},
      {ticket_type_id: 'std', paid: 60, held: 9},
    ])

    const usage = await getTicketTypeUsage('event-1')

    expect(usage.get('vip')).toEqual({paid: 5, held: 12, used: 17})
    expect(usage.get('std')).toEqual({paid: 60, held: 9, used: 69})
    expect(usage.get('missing')).toBeUndefined()
  })

  it('scopes to one event when given an id', async () => {
    query.mockResolvedValue([])
    await getTicketTypeUsage('event-1')

    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('o.event_id = ?')
    expect(params).toEqual(['event-1'])
  })

  it('covers every event when no id is given', async () => {
    query.mockResolvedValue([])
    await getTicketTypeUsage()

    const [sql, params] = query.mock.calls[0]
    expect(sql).not.toContain('o.event_id = ?')
    expect(params).toEqual([])
  })

  it('counts tickets reached through the seat as well as directly', async () => {
    query.mockResolvedValue([])
    await getTicketTypeUsage('event-1')

    // Roughly a quarter of existing items carry no ticket_type_id of their own
    // and are only reachable through the seat they were assigned.
    expect(query.mock.calls[0][0]).toContain(
      'COALESCE(oi.ticket_type_id, s.ticket_type_id)',
    )
  })

  it('excludes expired pending orders from held', async () => {
    query.mockResolvedValue([])
    await getTicketTypeUsage('event-1')

    const sql = query.mock.calls[0][0]
    expect(sql).toContain("o.status = 'PENDING' AND o.expires_at > NOW()")
    expect(sql).toContain("o.status = 'PENDING_CONFIRMATION'")
  })

  it('tolerates NULL aggregates from the database', async () => {
    query.mockResolvedValue([{ticket_type_id: 'vip', paid: null, held: null}])

    expect((await getTicketTypeUsage()).get('vip')).toEqual({
      paid: 0,
      held: 0,
      used: 0,
    })
  })
})
