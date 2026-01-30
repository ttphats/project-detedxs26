import { NextRequest, NextResponse } from 'next/server';
import { query, execute, Event } from '@/lib/db';
import { randomUUID } from 'crypto';

export interface Speaker {
  id: string;
  event_id: string;
  name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  image_url: string | null;
  topic: string | null;
  social_links: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// GET /api/admin/speakers - List all speakers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    let sql = `
      SELECT s.*, e.name as event_name 
      FROM speakers s 
      LEFT JOIN events e ON s.event_id = e.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (eventId) {
      sql += ' AND s.event_id = ?';
      params.push(eventId);
    }

    sql += ' ORDER BY s.sort_order, s.name';

    const speakers = await query<Speaker & { event_name: string }>(sql, params);
    const events = await query<Event>('SELECT id, name FROM events ORDER BY created_at DESC');

    return NextResponse.json({
      success: true,
      data: { speakers, events }
    });
  } catch (error: any) {
    console.error('Get speakers error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch speakers' },
      { status: 500 }
    );
  }
}

// POST /api/admin/speakers - Create speaker
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, name, title, company, bio, image_url, topic, social_links, sort_order } = body;

    if (!event_id || !name) {
      return NextResponse.json(
        { success: false, error: 'Event ID and name are required' },
        { status: 400 }
      );
    }

    const id = randomUUID();
    await execute(
      `INSERT INTO speakers (id, event_id, name, title, company, bio, image_url, topic, social_links, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event_id,
        name,
        title || null,
        company || null,
        bio || null,
        image_url || null,
        topic || null,
        social_links ? JSON.stringify(social_links) : null,
        sort_order || 0
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Speaker created successfully'
    });
  } catch (error: any) {
    console.error('Create speaker error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create speaker' },
      { status: 500 }
    );
  }
}

