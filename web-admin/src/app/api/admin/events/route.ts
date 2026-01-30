import { NextRequest, NextResponse } from 'next/server';
import { query, execute, Event } from '@/lib/db';
import { randomUUID } from 'crypto';

// Helper to generate slug
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// GET /api/admin/events - List all events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let sql = `
      SELECT e.*, 
        (SELECT COUNT(*) FROM seats WHERE event_id = e.id) as total_seats,
        (SELECT COUNT(*) FROM seats WHERE event_id = e.id AND status = 'BOOKED') as booked_seats,
        (SELECT COUNT(*) FROM speakers WHERE event_id = e.id AND is_active = 1) as speaker_count
      FROM events e
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    // Order by: PUBLISHED first, then by event_date DESC
    sql += ' ORDER BY CASE WHEN e.status = "PUBLISHED" THEN 0 ELSE 1 END, e.event_date DESC';

    const events = await query<Event & { 
      total_seats: number; 
      booked_seats: number;
      speaker_count: number;
    }>(sql, params);

    return NextResponse.json({
      success: true,
      data: events
    });
  } catch (error: any) {
    console.error('Get events error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST /api/admin/events - Create new event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      venue,
      event_date,
      doors_open_time,
      start_time,
      end_time,
      max_capacity,
      banner_image_url,
      thumbnail_url,
      status = 'DRAFT'
    } = body;

    if (!name || !venue || !event_date) {
      return NextResponse.json(
        { success: false, error: 'Name, venue, and event date are required' },
        { status: 400 }
      );
    }

    const id = `evt-${slugify(name)}-${Date.now().toString(36)}`;
    const slug = slugify(name);

    // Check if slug exists
    const existing = await query<Event>('SELECT id FROM events WHERE slug = ?', [slug]);
    const finalSlug = existing.length > 0 ? `${slug}-${Date.now().toString(36)}` : slug;

    await execute(
      `INSERT INTO events (
        id, name, slug, description, venue, 
        event_date, doors_open_time, start_time, end_time,
        status, max_capacity, available_seats, 
        banner_image_url, thumbnail_url, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        finalSlug,
        description || null,
        venue,
        new Date(event_date),
        doors_open_time ? new Date(doors_open_time) : new Date(event_date),
        start_time ? new Date(start_time) : new Date(event_date),
        end_time ? new Date(end_time) : new Date(event_date),
        status,
        max_capacity || 100,
        max_capacity || 100,
        banner_image_url || null,
        thumbnail_url || null,
        status === 'PUBLISHED' ? 1 : 0
      ]
    );

    const [newEvent] = await query<Event>('SELECT * FROM events WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      data: newEvent,
      message: 'Event created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create event error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create event' },
      { status: 500 }
    );
  }
}

