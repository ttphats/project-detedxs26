import { getPool } from '../../db/mysql.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { randomUUID } from 'crypto';

interface TicketType extends RowDataPacket {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  subtitle: string | null;
  benefits: string | null;
  price: number;
  color: string;
  icon: string;
  max_quantity: number | null;
  sort_order: number;
  event_name: string;
}

interface Event extends RowDataPacket {
  id: string;
  name: string;
  status: string;
}

interface SeatCount extends RowDataPacket {
  count: number;
}

/**
 * List all ticket types
 */
export async function listTicketTypes(eventId?: string) {
  const pool = getPool();

  let sql = `
    SELECT tt.*, e.name as event_name
    FROM ticket_types tt
    LEFT JOIN events e ON tt.event_id = e.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (eventId) {
    sql += ' AND tt.event_id = ?';
    params.push(eventId);
  }

  sql += ' ORDER BY tt.sort_order, tt.name';

  const [ticketTypes] = await pool.query<TicketType[]>(sql, params);
  // Get events - PUBLISHED first
  const [events] = await pool.query<Event[]>('SELECT id, name, status FROM events ORDER BY status ASC, created_at DESC');

  return { ticketTypes, events };
}

/**
 * Create ticket type
 */
export async function createTicketType(data: {
  event_id: string;
  name: string;
  description?: string;
  subtitle?: string;
  benefits?: string[];
  price?: number;
  level?: number;
  color?: string;
  icon?: string;
  max_quantity?: number;
  sort_order?: number;
}) {
  const pool = getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO ticket_types (id, event_id, name, description, subtitle, benefits, price, level, color, icon, max_quantity, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.event_id,
      data.name,
      data.description || null,
      data.subtitle || null,
      data.benefits ? JSON.stringify(data.benefits) : null,
      data.price || 0,
      data.level || 1, // Default to level 1 if not provided
      data.color || '#10b981',
      data.icon || '🎫',
      data.max_quantity || null,
      data.sort_order || 0
    ]
  );

  return { id };
}

/**
 * Update ticket type
 */
export async function updateTicketType(id: string, data: {
  name?: string;
  description?: string;
  subtitle?: string;
  benefits?: string[];
  price?: number;
  level?: number;
  color?: string;
  icon?: string;
  max_quantity?: number;
  sort_order?: number;
  is_active?: boolean;
}) {
  const pool = getPool();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description || null);
  }
  if (data.subtitle !== undefined) {
    updates.push('subtitle = ?');
    params.push(data.subtitle || null);
  }
  if (data.benefits !== undefined) {
    updates.push('benefits = ?');
    params.push(data.benefits ? JSON.stringify(data.benefits) : null);
  }
  if (data.price !== undefined) {
    updates.push('price = ?');
    params.push(data.price);
  }
  if (data.level !== undefined) {
    updates.push('level = ?');
    params.push(data.level);
  }
  if (data.color !== undefined) {
    updates.push('color = ?');
    params.push(data.color);
  }
  if (data.icon !== undefined) {
    updates.push('icon = ?');
    params.push(data.icon);
  }
  if (data.max_quantity !== undefined) {
    updates.push('max_quantity = ?');
    params.push(data.max_quantity || null);
  }
  if (data.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(data.sort_order);
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(data.is_active);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = NOW()');
  params.push(id);

  await pool.query(
    `UPDATE ticket_types SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return { success: true };
}

/**
 * Bulk update - assign ticket type to seats
 */
export async function assignTicketTypeToSeats(ticketTypeId: string | null, seatIds: string[]) {
  const pool = getPool();
  const placeholders = seatIds.map(() => '?').join(',');
  await pool.query(
    `UPDATE seats SET ticket_type_id = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
    [ticketTypeId, ...seatIds]
  );

  return { affected: seatIds.length };
}

/**
 * Delete ticket type
 */
export async function deleteTicketType(id: string) {
  const pool = getPool();

  // Check if any seats use this ticket type
  const [seats] = await pool.query<SeatCount[]>(
    'SELECT COUNT(*) as count FROM seats WHERE ticket_type_id = ?',
    [id]
  );

  if (seats[0].count > 0) {
    throw new Error(`Cannot delete: ${seats[0].count} seats use this ticket type`);
  }

  await pool.query('DELETE FROM ticket_types WHERE id = ?', [id]);
  return { success: true };
}

