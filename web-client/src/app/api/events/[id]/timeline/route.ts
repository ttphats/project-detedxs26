import { NextRequest, NextResponse } from 'next/server';
import { query, EventTimeline } from '@/lib/db';

// GET /api/events/[id]/timeline - Get published timeline for an event (public API)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First try with event ID
    let timelines = await query<EventTimeline>(
      `SELECT id, event_id, start_time, end_time, title, description, 
              speaker_name, speaker_avatar_url, type, order_index
       FROM event_timelines 
       WHERE event_id = ? AND status = 'PUBLISHED' 
       ORDER BY order_index ASC, start_time ASC`,
      [id]
    );

    // If no timelines found with event_id, try with event slug
    if (timelines.length === 0) {
      const eventBySlug = await query<{ id: string }>(
        `SELECT id FROM events WHERE slug = ? LIMIT 1`,
        [id]
      );

      if (eventBySlug.length > 0) {
        timelines = await query<EventTimeline>(
          `SELECT id, event_id, start_time, end_time, title, description, 
                  speaker_name, speaker_avatar_url, type, order_index
           FROM event_timelines 
           WHERE event_id = ? AND status = 'PUBLISHED' 
           ORDER BY order_index ASC, start_time ASC`,
          [eventBySlug[0].id]
        );
      }
    }

    // Transform to client format
    const formattedTimelines = timelines.map(t => ({
      id: t.id,
      startTime: t.start_time,
      endTime: t.end_time,
      title: t.title,
      description: t.description || '',
      speakerName: t.speaker_name || null,
      speakerAvatar: t.speaker_avatar_url || null,
      type: t.type,
    }));

    return NextResponse.json({
      success: true,
      data: formattedTimelines
    });
  } catch (error: any) {
    console.error('Get timeline error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}

