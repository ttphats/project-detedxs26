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
  image_url: string | null;
  max_quantity: number | null;
  sort_order: number;
  event_name: string;
}

interface Event extends RowDataPacket {
  id: string;
  name: string;
  status: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

interface SoldCount extends RowDataPacket {
  ticket_type_id: string | null;
  sold: number;
}

/**
 * Order statuses that count as a ticket being sold: money is committed
 * either way. PENDING is an in-progress cart that can still expire, and
 * CANCELLED/EXPIRED no longer hold stock, so neither counts.
 */
const SOLD_ORDER_STATUSES = ['PAID', 'PENDING_CONFIRMATION'];

/**
 * Real sold counts per ticket type, derived from order_items.
 *
 * The `ticket_types.sold_quantity` column is NOT used: nothing in the
 * app ever increments it (it is only ever written back to 0 by seeding
 * and reset-data), so it always read 0 no matter how many orders came
 * in. Deriving from orders means the number can't drift out of sync.
 */
async function getSoldCounts(eventId?: string): Promise<Map<string, number>> {
  const pool = getPool();

  const params: any[] = [...SOLD_ORDER_STATUSES];
  let eventFilter = '';
  if (eventId) {
    eventFilter = ' AND o.event_id = ?';
    params.push(eventId);
  }

  const [rows] = await pool.query<SoldCount[]>(
    `SELECT oi.ticket_type_id AS ticket_type_id, COUNT(*) AS sold
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status IN (?, ?)${eventFilter}
       AND oi.ticket_type_id IS NOT NULL
     GROUP BY oi.ticket_type_id`,
    params
  );

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.ticket_type_id) counts.set(row.ticket_type_id, Number(row.sold));
  }
  return counts;
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

  const [rawTicketTypes] = await pool.query<TicketType[]>(sql, params);
  const soldCounts = await getSoldCounts(eventId);

  const ticketTypes = rawTicketTypes.map((tt) => ({
    ...tt,
    sold_quantity: soldCounts.get(tt.id) ?? 0,
  }));

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
  image_url?: string | null;
  max_quantity?: number;
  sort_order?: number;
}) {
  const pool = getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO ticket_types (id, event_id, name, description, subtitle, benefits, price, level, color, icon, image_url, max_quantity, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      data.image_url || null,
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
  image_url?: string | null;
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
  if (data.image_url !== undefined) {
    updates.push('image_url = ?');
    params.push(data.image_url || null);
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
 * Delete ticket type
 */
export async function deleteTicketType(id: string) {
  const pool = getPool();

  // Block deletion while tickets of this type exist, so historical
  // orders never end up pointing at a ticket type that's gone.
  const [sold] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) as count FROM order_items WHERE ticket_type_id = ?',
    [id]
  );

  if (sold[0].count > 0) {
    throw new Error(`Cannot delete: ${sold[0].count} ticket(s) of this type have been ordered`);
  }

  await pool.query('DELETE FROM ticket_types WHERE id = ?', [id]);
  return { success: true };
}

