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
 * Get dashboard statistics
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
    prisma.seat.count({ where: { status: 'SOLD' } }),
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

