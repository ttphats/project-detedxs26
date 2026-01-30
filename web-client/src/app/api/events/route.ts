import { NextRequest, NextResponse } from 'next/server';
import { query, Event } from '@/lib/db';

// GET /api/events - List all published events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PUBLISHED';
    const featured = searchParams.get('featured');

    let sql = `
      SELECT e.*, 
        (SELECT COUNT(*) FROM speakers WHERE event_id = e.id AND is_active = 1) as speaker_count
      FROM events e
      WHERE e.status = ?
    `;
    const params: any[] = [status];

    sql += ' ORDER BY e.event_date ASC';

    const events = await query<Event & { speaker_count: number }>(sql, params);

    // Format events for client
    const formattedEvents = events.map(event => ({
      id: event.id,
      name: event.name,
      slug: event.slug,
      tagline: extractTagline(event.name),
      description: event.description,
      date: event.event_date,
      time: `${formatTime(event.doors_open_time)} - ${formatTime(event.end_time)}`,
      venue: event.venue,
      location: 'Ho Chi Minh City, Vietnam',
      bannerImageUrl: event.banner_image_url,
      thumbnailUrl: event.thumbnail_url,
      speakerCount: event.speaker_count,
      background: {
        type: 'image',
        value: event.banner_image_url || 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1920&h=1080&fit=crop',
        overlay: 'linear-gradient(135deg, rgba(230,43,30,0.9) 0%, rgba(26,26,26,0.95) 100%)',
      },
      highlights: [
        { icon: 'mic', text: `${event.speaker_count || 12}+ Speakers` },
        { icon: 'lightbulb', text: 'Ideas Worth Spreading' },
        { icon: 'users', text: '500+ Attendees' },
        { icon: 'coffee', text: 'Networking Sessions' },
      ],
    }));

    // If featured=true, return the first event
    if (featured === 'true' && formattedEvents.length > 0) {
      return NextResponse.json({
        success: true,
        data: formattedEvents[0],
      });
    }

    return NextResponse.json({
      success: true,
      data: formattedEvents,
    });
  } catch (error: any) {
    console.error('Get events error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

function formatTime(date: Date): string {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function extractTagline(name: string): string {
  // Extract tagline from event name (e.g., "TEDxFPTUniversityHCMC 2026: Finding Flow" -> "Finding Flow")
  const match = name.match(/:\s*(.+)$/);
  return match ? match[1] : '';
}

