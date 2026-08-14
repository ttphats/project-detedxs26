import { prisma } from '../../db/prisma.js';

export interface DashboardStats {
  totalEvents: number;
  totalOrders: number;
  ticketsSold: number;
  revenue: number;
  /** Remaining capacity across ticket types that declare a max_quantity. */
  ticketsRemaining: number;
  pendingOrders: number;
}

/** Order statuses whose tickets count as sold/held. */
const SOLD_STATUSES = ['PAID', 'PENDING_CONFIRMATION'];

/**
 * Get dashboard statistics.
 *
 * Ticket counts come from order_items rather than seats: the venue has no
 * seat map, so capacity is defined by ticket_types.max_quantity and usage
 * by how many tickets have actually been ordered.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    totalEvents,
    totalOrders,
    ticketsSold,
    revenueResult,
    capacityResult,
    pendingOrders,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.order.count(),
    prisma.orderItem.count({
      where: { order: { status: { in: SOLD_STATUSES } } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'PAID' },
    }),
    // ticket_types isn't modelled in Prisma, so query it directly.
    prisma.$queryRaw<Array<{ capacity: number | null }>>`
      SELECT SUM(max_quantity) AS capacity FROM ticket_types WHERE is_active = 1
    `,
    prisma.order.count({
      where: {
        status: { in: ['PENDING', 'PENDING_CONFIRMATION'] },
      },
    }),
  ]);

  const capacity = Number(capacityResult?.[0]?.capacity || 0);

  return {
    totalEvents,
    totalOrders,
    ticketsSold,
    revenue: Number(revenueResult._sum.totalAmount || 0),
    ticketsRemaining: Math.max(0, capacity - ticketsSold),
    pendingOrders,
  };
}
