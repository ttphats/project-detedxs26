import { getPool } from '../../db/mysql.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { randomUUID } from 'crypto';

interface EventTimeline extends RowDataPacket {
  id: string;
  event_id: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string | null;
  speaker_name: string | null;
  speaker_avatar_url: string | null;
  type: string;
  order_index: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTimelineInput {
  event_id: string;
  start_time: string;
  end_time: string;
  title: string;
  description?: string;
  speaker_name?: string;
  speaker_avatar_url?: string;
  type?: string;
  order_index?: number;
  status?: string;
}

/**
 * List timelines with optional filters
 */
export async function listTimelines(eventId?: string, status?: string) {
  const pool = getPool();

  let sql = 'SELECT * FROM event_timelines WHERE 1=1';
  const params: any[] = [];

  if (eventId) {
    sql += ' AND event_id = ?';
    params.push(eventId);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY order_index ASC, start_time ASC';

  const [timelines] = await pool.query<EventTimeline[]>(sql, params);
  return timelines;
}

/**
 * Create new timeline
 */
export async function createTimeline(data: CreateTimelineInput) {
  const pool = getPool();

  // Validation
  if (!data.event_id || !data.start_time || !data.end_time || !data.title) {
    throw new Error('event_id, start_time, end_time, and title are required');
  }

  // Validate time format (HH:mm)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(data.start_time) || !timeRegex.test(data.end_time)) {
    throw new Error('Invalid time format. Use HH:mm');
  }

  // Validate type
  const validTypes = ['TALK', 'BREAK', 'CHECKIN', 'OTHER', 'SPEAKER'];
  const type = data.type || 'OTHER';
  if (!validTypes.includes(type)) {
    throw new Error('Invalid type. Must be TALK, BREAK, CHECKIN, SPEAKER, or OTHER');
  }

  const id = randomUUID();

  await pool.query(
    `INSERT INTO event_timelines
     (id, event_id, start_time, end_time, title, description, speaker_name, speaker_avatar_url, type, order_index, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.event_id,
      data.start_time,
      data.end_time,
      data.title,
      data.description || null,
      data.speaker_name || null,
      data.speaker_avatar_url || null,
      type,
      data.order_index ?? 0,
      data.status || 'DRAFT'
    ]
  );

  // Fetch created timeline
  const [created] = await pool.query<EventTimeline[]>(
    'SELECT * FROM event_timelines WHERE id = ?',
    [id]
  );

  return created[0];
}

/**
 * Update timeline
 */
export async function updateTimeline(id: string, data: Partial<CreateTimelineInput>) {
  const pool = getPool();

  const updates: string[] = [];
  const params: any[] = [];

  if (data.start_time !== undefined) {
    updates.push('start_time = ?');
    params.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    updates.push('end_time = ?');
    params.push(data.end_time);
  }
  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.speaker_name !== undefined) {
    updates.push('speaker_name = ?');
    params.push(data.speaker_name);
  }
  if (data.speaker_avatar_url !== undefined) {
    updates.push('speaker_avatar_url = ?');
    params.push(data.speaker_avatar_url);
  }
  if (data.type !== undefined) {
    updates.push('type = ?');
    params.push(data.type);
  }
  if (data.order_index !== undefined) {
    updates.push('order_index = ?');
    params.push(data.order_index);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = NOW()');
  params.push(id);

  await pool.query(
    `UPDATE event_timelines SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  // Return updated timeline
  const [updated] = await pool.query<EventTimeline[]>(
    'SELECT * FROM event_timelines WHERE id = ?',
    [id]
  );

  return updated[0];
}

/**
 * Delete timeline
 */
export async function deleteTimeline(id: string) {
  const pool = getPool();
  await pool.query('DELETE FROM event_timelines WHERE id = ?', [id]);
  return { success: true };
}

