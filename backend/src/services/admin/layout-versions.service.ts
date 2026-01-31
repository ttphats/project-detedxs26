import { getPool } from '../../db/mysql.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { randomUUID } from 'crypto';

interface LayoutVersion extends RowDataPacket {
  id: string;
  event_id: string;
  version_name: string;
  description: string | null;
  layout_config: string;
  seats_data: string;
  status: 'DRAFT' | 'PUBLISHED';
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
}

interface Event extends RowDataPacket {
  id: string;
  name: string;
}

interface TicketType extends RowDataPacket {
  id: string;
  name: string;
  price: number;
  color: string;
}

/**
 * List layout versions for an event
 */
export async function listLayoutVersions(eventId: string) {
  const pool = getPool();

  const [versions] = await pool.query<LayoutVersion[]>(
    `SELECT * FROM seat_layout_versions
     WHERE event_id = ?
     ORDER BY created_at DESC`,
    [eventId]
  );

  // Parse JSON fields
  const parsedVersions = versions.map((v: LayoutVersion) => ({
    ...v,
    layout_config: typeof v.layout_config === 'string' ? JSON.parse(v.layout_config) : v.layout_config,
    seats_data: typeof v.seats_data === 'string' ? JSON.parse(v.seats_data) : v.seats_data,
  }));

  // Get events for dropdown
  const [events] = await pool.query<Event[]>(
    'SELECT id, name FROM events ORDER BY created_at DESC'
  );

  // Get ticket types for the event
  const [ticketTypes] = await pool.query<TicketType[]>(
    'SELECT id, name, price, color FROM ticket_types WHERE event_id = ? ORDER BY sort_order',
    [eventId]
  );

  return {
    versions: parsedVersions,
    events,
    ticketTypes,
  };
}

/**
 * Create new draft version
 */
export async function createLayoutVersion(data: {
  event_id: string;
  version_name: string;
  description?: string;
  layout_config: any;
  seats_data: any;
}) {
  const pool = getPool();
  const id = randomUUID();

  await pool.query(
    `INSERT INTO seat_layout_versions
     (id, event_id, version_name, description, layout_config, seats_data, status, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', FALSE, NOW(), NOW())`,
    [
      id,
      data.event_id,
      data.version_name,
      data.description || null,
      JSON.stringify(data.layout_config),
      JSON.stringify(data.seats_data),
    ]
  );

  return { id };
}

/**
 * Delete a draft version
 */
export async function deleteLayoutVersion(id: string) {
  const pool = getPool();

  // Check if it's a draft
  const [versions] = await pool.query<LayoutVersion[]>(
    'SELECT * FROM seat_layout_versions WHERE id = ?',
    [id]
  );

  const version = versions[0];
  if (!version) {
    throw new Error('Version not found');
  }

  if (version.is_active) {
    throw new Error('Cannot delete active version');
  }

  await pool.query('DELETE FROM seat_layout_versions WHERE id = ?', [id]);
  return { success: true };
}

