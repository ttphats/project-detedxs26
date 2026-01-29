import { NextRequest, NextResponse } from 'next/server';
import { query, Event, TicketType, Seat } from '@/lib/db';

// GET /api/events/[id] - Get event details with seats and ticket types
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get event by ID or slug
    const event = await query<Event>(
      `SELECT * FROM events WHERE id = ? OR slug = ? LIMIT 1`,
      [id, id]
    );

    if (event.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const eventData = event[0];

    // Get ticket types for this event
    const ticketTypes = await query<TicketType>(
      `SELECT * FROM ticket_types WHERE event_id = ? AND is_active = 1 ORDER BY sort_order, name`,
      [eventData.id]
    );

    // Get seats for this event (only AVAILABLE and SOLD)
    // Order by row, then section (LEFT first), then col
    const seats = await query<Seat>(
      `SELECT id, seat_number, row, col, section, seat_type, price, status
       FROM seats
       WHERE event_id = ? AND status IN ('AVAILABLE', 'SOLD', 'RESERVED', 'LOCKED')
       ORDER BY row, FIELD(section, 'LEFT', 'RIGHT'), col`,
      [eventData.id]
    );

    // Group seats by row for seatMap format
    const seatsByRow = seats.reduce((acc: Record<string, Seat[]>, seat) => {
      if (!acc[seat.row]) {
        acc[seat.row] = [];
      }
      acc[seat.row].push(seat);
      return acc;
    }, {});

    // Convert to seatMap format matching web-client
    const seatMap = Object.keys(seatsByRow)
      .sort()
      .map(row => ({
        row,
        seats: seatsByRow[row].map(seat => ({
          id: seat.seat_number,
          row: seat.row,
          number: seat.col,
          section: seat.section,
          status: seat.status === 'AVAILABLE' ? 'available' : 'sold',
          ticketTypeId: seat.seat_type.toLowerCase(),
          seatType: seat.seat_type,
          price: Number(seat.price),
        })),
      }));

    // Format ticket types for web-client
    const formattedTicketTypes = ticketTypes.map(tt => ({
      id: tt.id,
      name: tt.name,
      price: Number(tt.price),
      description: tt.description || '',
      subtitle: tt.subtitle,
      benefits: tt.benefits ? JSON.parse(tt.benefits) : [],
      color: tt.color,
      icon: tt.icon,
    }));

    // Calculate stats
    const stats = {
      total: seats.length,
      available: seats.filter(s => s.status === 'AVAILABLE').length,
      sold: seats.filter(s => s.status === 'SOLD').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        id: eventData.id,
        name: eventData.name,
        slug: eventData.slug,
        tagline: 'Finding Flow', // hardcoded for now
        description: eventData.description,
        date: eventData.event_date,
        time: `${formatTime(eventData.doors_open_time)} - ${formatTime(eventData.end_time)}`,
        venue: eventData.venue,
        location: 'Ho Chi Minh City, Vietnam',
        bannerImageUrl: eventData.banner_image_url,
        thumbnailUrl: eventData.thumbnail_url,
        ticketTypes: formattedTicketTypes,
        seatMap,
        stats,
        // Default highlights and background for TEDx
        highlights: [
          { icon: 'mic', text: '12 Inspiring Speakers' },
          { icon: 'lightbulb', text: 'Ideas Worth Spreading' },
          { icon: 'users', text: '500+ Attendees' },
          { icon: 'coffee', text: 'Networking Sessions' },
        ],
        background: {
          type: 'image',
          value: eventData.banner_image_url || 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1920&h=1080&fit=crop',
          overlay: 'linear-gradient(135deg, rgba(230,43,30,0.9) 0%, rgba(26,26,26,0.95) 100%)',
        },
      },
    });
  } catch (error: any) {
    console.error('Get event error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

