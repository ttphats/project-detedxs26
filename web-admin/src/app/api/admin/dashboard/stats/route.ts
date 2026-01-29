import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get total events
    const eventsResult = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM events'
    );

    // Get total orders
    const ordersResult = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM orders'
    );

    // Get tickets sold (SOLD seats)
    const ticketsResult = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM seats WHERE status = 'SOLD'"
    );

    // Get revenue (sum of PAID orders)
    const revenueResult = await queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status = 'PAID'"
    );

    // Get available seats
    const availableResult = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM seats WHERE status = 'AVAILABLE'"
    );

    // Get pending orders
    const pendingResult = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'PENDING'"
    );

    return NextResponse.json({
      success: true,
      data: {
        totalEvents: eventsResult?.count || 0,
        totalOrders: ordersResult?.count || 0,
        ticketsSold: ticketsResult?.count || 0,
        revenue: revenueResult?.total || 0,
        availableSeats: availableResult?.count || 0,
        pendingOrders: pendingResult?.count || 0,
      }
    });
  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

