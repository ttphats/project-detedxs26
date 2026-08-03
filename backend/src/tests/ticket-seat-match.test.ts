import {describe, it, expect} from 'vitest'
import {
  seatTypeAliasesForTicketType,
  seatMatchesTicketType,
  normalizeSeatKey,
} from '../utils/ticket-seat-match.js'

describe('ticket-seat-match', () => {
  it('normalizes seat keys', () => {
    expect(normalizeSeatKey('early bird')).toBe('EARLY_BIRD')
    expect(normalizeSeatKey('LEVEL-2')).toBe('LEVEL_2')
  })

  it('Early Bird maps to ECONOMY / LEVEL_1 (not LEVEL_5 only)', () => {
    const aliases = seatTypeAliasesForTicketType({name: 'Early Bird', level: 5})
    expect(aliases).toEqual(expect.arrayContaining(['ECONOMY', 'EARLY_BIRD', 'LEVEL_1']))
    expect(aliases).toContain('LEVEL_5')
  })

  it('Standard maps to STANDARD / LEVEL_2', () => {
    const aliases = seatTypeAliasesForTicketType({name: 'Standard', level: 2})
    expect(aliases).toEqual(expect.arrayContaining(['STANDARD', 'LEVEL_2']))
  })

  it('VIP maps to VIP', () => {
    const aliases = seatTypeAliasesForTicketType({name: 'VIP', level: 4})
    expect(aliases).toEqual(expect.arrayContaining(['VIP', 'LEVEL_4']))
  })

  it('Donor maps to DONOR and VIP fallback', () => {
    const aliases = seatTypeAliasesForTicketType({name: 'Donor', level: 3})
    expect(aliases).toEqual(expect.arrayContaining(['DONOR']))
  })

  it('matches seats by ticket_type_id first', () => {
    const tt = {id: 'tt-1', name: 'Early Bird', level: 5}
    expect(
      seatMatchesTicketType({ticket_type_id: 'tt-1', seat_type: 'WHATEVER'}, tt),
    ).toBe(true)
  })

  it('matches Early Bird to ECONOMY seats without ticket_type_id', () => {
    const tt = {id: 'tt-eb', name: 'Early Bird', level: 5}
    expect(seatMatchesTicketType({ticket_type_id: null, seat_type: 'ECONOMY'}, tt)).toBe(
      true,
    )
    expect(seatMatchesTicketType({ticket_type_id: null, seat_type: 'LEVEL_1'}, tt)).toBe(
      true,
    )
    // Should NOT require only LEVEL_5
    expect(seatMatchesTicketType({ticket_type_id: null, seat_type: 'STANDARD'}, tt)).toBe(
      false,
    )
  })

  it('does not match Standard to ECONOMY', () => {
    const tt = {id: 'tt-std', name: 'Standard', level: 2}
    expect(seatMatchesTicketType({ticket_type_id: null, seat_type: 'ECONOMY'}, tt)).toBe(
      false,
    )
    expect(seatMatchesTicketType({ticket_type_id: null, seat_type: 'STANDARD'}, tt)).toBe(
      true,
    )
  })
})
