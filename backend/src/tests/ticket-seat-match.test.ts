import {describe, it, expect} from 'vitest'
import {
  seatTypeAliasesForTicketType,
  seatMatchesTicketType,
  allocateTicketInventory,
  isEarlyBirdType,
} from '../utils/ticket-seat-match.js'

describe('ticket-seat-match', () => {
  it('detects Early Bird', () => {
    expect(isEarlyBirdType({name: 'Early Bird', level: 5})).toBe(true)
    expect(isEarlyBirdType({name: 'Standard', level: 2})).toBe(false)
  })

  it('Early Bird aliases include LEVEL_2 shared pool', () => {
    const a = seatTypeAliasesForTicketType({name: 'Early Bird', level: 5})
    expect(a).toEqual(expect.arrayContaining(['LEVEL_2', 'ECONOMY', 'LEVEL_5']))
  })

  it('matches Early Bird to LEVEL_2 seats', () => {
    const tt = {id: 'eb', name: 'Early Bird', level: 5}
    expect(seatMatchesTicketType({ticket_type_id: null, seat_type: 'LEVEL_2'}, tt)).toBe(true)
  })

  it('allocates Early Bird up to max_quantity from LEVEL_2, rest to Standard', () => {
    const types = [
      {id: 'vip', name: 'VIP', level: 4, max_quantity: 5},
      {id: 'donor', name: 'Donor', level: 3, max_quantity: 10},
      {id: 'std', name: 'Standard', level: 2, max_quantity: 65},
      {id: 'eb', name: 'Early Bird', level: 5, max_quantity: 20},
    ]
    const seatStats = [
      {ticket_type_id: null, seat_type: 'LEVEL_4', status: 'AVAILABLE', count: 10},
      {ticket_type_id: null, seat_type: 'LEVEL_4', status: 'SOLD', count: 2},
      {ticket_type_id: null, seat_type: 'LEVEL_3', status: 'AVAILABLE', count: 10},
      {ticket_type_id: null, seat_type: 'LEVEL_3', status: 'SOLD', count: 2},
      {ticket_type_id: null, seat_type: 'LEVEL_2', status: 'AVAILABLE', count: 64},
      {ticket_type_id: null, seat_type: 'LEVEL_2', status: 'SOLD', count: 20},
    ]
    const inv = allocateTicketInventory(types, seatStats, [])
    const byId = Object.fromEntries(inv.map((x) => [x.ticketTypeId, x]))

    expect(byId.vip.totalSeats).toBe(5)
    expect(byId.donor.totalSeats).toBe(10)
    expect(byId.eb.totalSeats).toBe(20)
    expect(byId.eb.available).toBeGreaterThan(0)
    expect(byId.std.totalSeats).toBeGreaterThan(0)
    expect(byId.std.totalSeats).toBeLessThanOrEqual(65)
    expect(byId.eb.totalSeats + byId.std.totalSeats).toBeLessThanOrEqual(84)
  })
})
