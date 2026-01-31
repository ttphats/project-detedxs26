import { getPool } from '../../db/mysql.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { randomUUID } from 'crypto';

interface Layout extends RowDataPacket {
  id: string;
  event_id: string;
  name: string;
  status: string;
  canvas_width: number;
  canvas_height: number;
  event_name: string;
  created_at: Date;
  updated_at: Date;
}

interface LayoutSection extends RowDataPacket {
  id: string;
  layout_id: string;
  name: string;
  sort_order: number;
}

interface Event extends RowDataPacket {
  id: string;
  name: string;
}

/**
 * List layouts with sections
 */
export async function listLayouts(eventId?: string) {
  const pool = getPool();

  let sql = `
    SELECT l.*, e.name as event_name
    FROM layouts l
    LEFT JOIN events e ON l.event_id = e.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (eventId) {
    sql += ' AND l.event_id = ?';
    params.push(eventId);
  }

  sql += ' ORDER BY l.created_at DESC';

  const [layouts] = await pool.query<Layout[]>(sql, params);
  const [events] = await pool.query<Event[]>('SELECT id, name FROM events ORDER BY created_at DESC');

  // Fetch sections for each layout
  const layoutsWithSections = await Promise.all(
    layouts.map(async (layout: Layout) => {
      const [sections] = await pool.query<LayoutSection[]>(
        'SELECT * FROM layout_sections WHERE layout_id = ? ORDER BY sort_order',
        [layout.id]
      );
      return { ...layout, sections };
    })
  );

  return { layouts: layoutsWithSections, events };
}

/**
 * Create new layout
 */
export async function createLayout(eventId: string, name?: string) {
  const pool = getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO layouts (id, event_id, name, status, canvas_width, canvas_height)
     VALUES (?, ?, ?, 'DRAFT', 1000, 600)`,
    [id, eventId, name || 'New Layout']
  );
  return { id };
}

/**
 * Update layout
 */
export async function updateLayout(id: string, data: { name?: string; status?: string }) {
  const pool = getPool();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
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

  await pool.query(`UPDATE layouts SET ${updates.join(', ')} WHERE id = ?`, params);
  return { success: true };
}

/**
 * Delete layout
 */
export async function deleteLayout(id: string) {
  const pool = getPool();
  // Delete sections first
  await pool.query('DELETE FROM layout_sections WHERE layout_id = ?', [id]);
  await pool.query('DELETE FROM layouts WHERE id = ?', [id]);
  return { success: true };
}

