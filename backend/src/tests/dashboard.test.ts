import {describe, it, expect, vi, beforeEach} from 'vitest'

const prisma = {
  event: {count: vi.fn()},
  order: {count: vi.fn(), aggregate: vi.fn()},
  orderItem: {count: vi.fn()},
  seat: {count: vi.fn()},
}

vi.mock('../db/prisma.js', () => ({prisma}))

const {getDashboardStats} = await import('../services/admin/dashboard.service.js')

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.event.count.mockResolvedValue(1)
    prisma.order.count.mockResolvedValue(10)
    // Ticket-class orders have no seats. 7 paid tickets vs 3 SOLD seats.
    prisma.orderItem.count.mockResolvedValue(7)
    prisma.seat.count.mockResolvedValue(3)
    prisma.order.aggregate.mockResolvedValue({_sum: {totalAmount: 1_500_000}})
  })

  it('counts sold tickets from PAID order items, not SOLD seats', async () => {
    const stats = await getDashboardStats()

    expect(prisma.orderItem.count).toHaveBeenCalledWith({
      where: {order: {status: 'PAID'}},
    })
    expect(stats.ticketsSold).toBe(7)
  })

  it('sums revenue from PAID orders only', async () => {
    const stats = await getDashboardStats()

    expect(prisma.order.aggregate).toHaveBeenCalledWith({
      _sum: {totalAmount: true},
      where: {status: 'PAID'},
    })
    expect(stats.revenue).toBe(1_500_000)
  })

  it('treats a missing revenue aggregate as zero', async () => {
    prisma.order.aggregate.mockResolvedValue({_sum: {totalAmount: null}})

    const stats = await getDashboardStats()

    expect(stats.revenue).toBe(0)
  })
})
