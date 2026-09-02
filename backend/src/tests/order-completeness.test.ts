import {describe, it, expect} from 'vitest'
import {findMissingOrderInfo} from '../utils/order-completeness.js'

const billing = {name: 'Nguyen Van A', email: 'a@example.com', phone: '0901234567'}
const holder = {orderItemId: 'oi-1', name: 'Tran B', email: 'b@example.com', phone: '0907654321'}

describe('findMissingOrderInfo', () => {
  it('accepts a fully filled order', () => {
    expect(findMissingOrderInfo(billing, [holder], 1)).toEqual([])
  })

  it('accepts an order with no attendees when none are expected', () => {
    expect(findMissingOrderInfo(billing, [])).toEqual([])
  })

  it.each([
    ['name', {...billing, name: ''}],
    ['email', {...billing, email: ''}],
    ['phone', {...billing, phone: ''}],
  ])('rejects a missing billing %s', (_field, input) => {
    expect(findMissingOrderInfo(input, [])).not.toEqual([])
  })

  it('rejects whitespace-only values, which a truthiness check would pass', () => {
    expect(' '.trim()).toBe('')
    const missing = findMissingOrderInfo({name: '   ', email: '  ', phone: '\t'}, [])
    expect(missing).toEqual(['billing name', 'billing email', 'billing phone'])
  })

  it('rejects a malformed billing email', () => {
    expect(findMissingOrderInfo({...billing, email: 'not-an-email'}, [])).toEqual([
      'a valid billing email',
    ])
  })

  it('rejects a blank holder, naming the ticket', () => {
    const missing = findMissingOrderInfo(billing, [{...holder, name: '', email: ''}])
    expect(missing).toContain('ticket 1: holder name')
    expect(missing).toContain('ticket 1: holder email')
  })

  it('names the right ticket when a later holder is incomplete', () => {
    const missing = findMissingOrderInfo(billing, [holder, {...holder, phone: ''}])
    expect(missing).toEqual(['ticket 2: holder phone'])
  })

  it('rejects an order that omitted holders rather than sending blank ones', () => {
    const missing = findMissingOrderInfo(billing, [holder], 3)
    expect(missing).toEqual(['details for all 3 ticket holders (1 provided)'])
  })

  it('reports every problem at once, so the buyer fixes them in one pass', () => {
    const missing = findMissingOrderInfo({name: '', email: 'bad', phone: ''}, [
      {...holder, name: ''},
    ])
    expect(missing).toEqual([
      'billing name',
      'a valid billing email',
      'billing phone',
      'ticket 1: holder name',
    ])
  })
})
