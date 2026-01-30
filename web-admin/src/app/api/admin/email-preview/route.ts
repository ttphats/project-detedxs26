import { NextRequest, NextResponse } from 'next/server';
import { generateFullTicketEmail } from '@/lib/email-templates/ticket-confirmation';

/**
 * GET /api/admin/email-preview
 * 
 * Preview email template with sample data (development only)
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  // Sample data for preview
  const sampleData = {
    customerName: 'Nguyễn Văn A',
    eventName: 'TEDx Ideas Worth Spreading 2026',
    eventDate: 'Thứ Bảy, 15 tháng 3, 2026',
    eventTime: '14:00',
    eventVenue: 'FPT University HCMC',
    eventAddress: 'Khu công nghệ cao, Quận 9, TP.HCM',
    orderNumber: 'ORD-2026-DEMO',
    seats: [
      { seatNumber: 'A1', seatType: 'VIP', section: 'VIP', row: 'A', price: 500000 },
      { seatNumber: 'A2', seatType: 'VIP', section: 'VIP', row: 'A', price: 500000 },
      { seatNumber: 'A3', seatType: 'Standard', section: 'General', row: 'A', price: 300000 },
    ],
    totalAmount: 1300000,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ORD-2026-DEMO',
    ticketUrl: 'http://localhost:3000/ticket/ORD-2026-DEMO?token=demo-token-12345',
    logoUrl: undefined,
  };

  const html = generateFullTicketEmail(sampleData);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

