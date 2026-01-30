import { NextRequest, NextResponse } from 'next/server';
import { query, Speaker } from '@/lib/db';

// GET /api/events/[id]/speakers - Get speakers for an event (public API)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get speakers for this event (only active ones, ordered by sort_order)
    const speakers = await query<Speaker>(
      `SELECT id, name, title, company, bio, image_url, topic, social_links, sort_order
       FROM speakers 
       WHERE event_id = ? AND is_active = 1 
       ORDER BY sort_order, name`,
      [id]
    );

    // If no speakers found with event_id, try with event slug
    if (speakers.length === 0) {
      const eventBySlug = await query<{ id: string }>(
        `SELECT id FROM events WHERE slug = ? LIMIT 1`,
        [id]
      );

      if (eventBySlug.length > 0) {
        const speakersByEventId = await query<Speaker>(
          `SELECT id, name, title, company, bio, image_url, topic, social_links, sort_order
           FROM speakers 
           WHERE event_id = ? AND is_active = 1 
           ORDER BY sort_order, name`,
          [eventBySlug[0].id]
        );
        
        // Transform to client format
        const formattedSpeakers = speakersByEventId.map(s => ({
          id: s.id,
          name: s.name,
          title: s.title || '',
          company: s.company || '',
          bio: s.bio || '',
          image: s.image_url || '',
          topic: s.topic || '',
          socialLinks: s.social_links ? JSON.parse(s.social_links) : null,
        }));

        return NextResponse.json({
          success: true,
          data: formattedSpeakers
        });
      }
    }

    // Transform to client format
    const formattedSpeakers = speakers.map(s => ({
      id: s.id,
      name: s.name,
      title: s.title || '',
      company: s.company || '',
      bio: s.bio || '',
      image: s.image_url || '',
      topic: s.topic || '',
      socialLinks: s.social_links ? JSON.parse(s.social_links) : null,
    }));

    return NextResponse.json({
      success: true,
      data: formattedSpeakers
    });
  } catch (error: any) {
    console.error('Get speakers error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch speakers' },
      { status: 500 }
    );
  }
}

