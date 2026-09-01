import { prisma } from '../../db/prisma.js';

export interface DashboardStats {
  totalEvents: number;
  totalOrders: number;
  ticketsSold: number;
  revenue: number;
  availableSeats: number;
  pendingOrders: number;
}

/**
 * Get dashboard statistics.
 *
 * Tickets sold come from PAID order_items, not SOLD seats. Ticket-class
 * orders have no seat row, so a seat count silently under-reports sales.
 * Revenue stays PAID-only so it matches the ticket-types "Đã bán" figure.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    totalEvents,
    totalOrders,
    ticketsSold,
    revenueResult,
    availableSeats,
    pendingOrders,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.order.count(),
    prisma.orderItem.count({
      where: { order: { status: 'PAID' } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'PAID' },
    }),
    prisma.seat.count({ where: { status: 'AVAILABLE' } }),
    prisma.order.count({
      where: {
        status: { in: ['PENDING', 'PENDING_CONFIRMATION'] },
      },
    }),
  ]);

  return {
    totalEvents,
    totalOrders,
    ticketsSold,
    revenue: Number(revenueResult._sum.totalAmount || 0),
    availableSeats,
    pendingOrders,
  };
}

