import { query, execute, queryOne, transaction, getPool } from '../../db/mysql.js';
import { randomUUID } from 'crypto';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { RowDataPacket } from 'mysql2';

let promotionsSchemaEnsured = false;

/** Prod schema predates these columns. INSERT names them → 500 if missing. */
async function ensurePromotionsSchema() {
  if (promotionsSchemaEnsured) return;
  const pool = getPool();
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'promotions'
         AND COLUMN_NAME IN ('max_per_customer', 'ticket_type_ids')`
    );
    const existing = new Set(rows.map((r) => String(r.COLUMN_NAME)));

    if (!existing.has('max_per_customer')) {
      await pool.query(
        `ALTER TABLE promotions
         ADD COLUMN max_per_customer INT NOT NULL DEFAULT 1 AFTER used_count`
      );
      console.log('[promotions] Added column max_per_customer');
    }
    if (!existing.has('ticket_type_ids')) {
      await pool.query(
        `ALTER TABLE promotions
         ADD COLUMN ticket_type_ids TEXT NULL AFTER max_per_customer`
      );
      console.log('[promotions] Added column ticket_type_ids');
    }
    promotionsSchemaEnsured = true;
  } catch (err) {
    console.error('[promotions] ensure schema failed:', err);
    promotionsSchemaEnsured = false;
    throw err;
  }
}

export interface Promotion {
  id: string;
  event_id: string;
  name: string;
  type: string;
  discount_type: string;
  discount_value: number;
  code: string | null;
  min_tickets: number | null;
  max_tickets: number | null;
  start_date: Date;
  end_date: Date;
  max_usage: number | null;
  used_count: number;
  max_per_customer: number;
  ticket_type_ids: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePromotionInput {
  eventId: string;
  name: string;
  type: string;
  discountType: string;
  discountValue: number;
  code?: string;
  minTickets?: number;
  maxTickets?: number;
  startDate: string;
  endDate: string;
  maxUsage?: number;
  maxPerCustomer?: number;
  ticketTypeIds?: string[];
  isActive?: boolean;
}

export interface UpdatePromotionInput extends Partial<CreatePromotionInput> {}

export async function listPromotions(eventId: string) {
  await ensurePromotionsSchema();
  const promotions = await query<Promotion>(
    'SELECT * FROM promotions WHERE event_id = ? ORDER BY created_at DESC',
    [eventId]
  );
  return promotions;
}

export async function getPromotion(id: string) {
  const promotion = await queryOne<Promotion>(
    'SELECT * FROM promotions WHERE id = ?',
    [id]
  );
  if (!promotion) throw new NotFoundError('Promotion not found');
  return promotion;
}

export async function createPromotion(input: CreatePromotionInput) {
  await ensurePromotionsSchema();
  const id = randomUUID();

  // Validate code uniqueness if provided
  if (input.code) {
    const existing = await queryOne('SELECT id FROM promotions WHERE code = ?', [input.code]);
    if (existing) throw new BadRequestError('Promo code already exists');
  }

  await execute(
    `INSERT INTO promotions (
      id, event_id, name, type, discount_type, discount_value, 
      code, min_tickets, max_tickets, start_date, end_date, 
      max_usage, max_per_customer, ticket_type_ids, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.eventId,
      input.name,
      input.type,
      input.discountType,
      input.discountValue,
      input.code || null,
      input.minTickets || null,
      input.maxTickets || null,
      new Date(input.startDate),
      new Date(input.endDate),
      input.maxUsage || null,
      input.maxPerCustomer || 1,
      input.ticketTypeIds ? JSON.stringify(input.ticketTypeIds) : null,
      input.isActive !== undefined ? input.isActive : true
    ]
  );

  return getPromotion(id);
}

export async function createPromotionsBulk(input: CreatePromotionInput & { codes: string[] }) {
  await ensurePromotionsSchema();
  const { codes } = input;
  
  // Validate array uniqueness and non-emptiness
  const uniqueCodes = Array.from(new Set(codes.map(c => c.trim().toUpperCase()))).filter(Boolean);
  if (uniqueCodes.length === 0) {
    throw new BadRequestError('Danh sách mã giảm giá trống');
  }

  // Check database uniqueness for all codes
  const placeholders = uniqueCodes.map(() => '?').join(',');
  const existing = await query<{ code: string }>(
    `SELECT code FROM promotions WHERE code IN (${placeholders})`,
    uniqueCodes
  );
  if (existing.length > 0) {
    const existingCodes = existing.map(e => e.code).join(', ');
    throw new BadRequestError(`Các mã giảm giá sau đã tồn tại: ${existingCodes}`);
  }

  // Insert in a transaction
  return await transaction(async (connection) => {
    for (const code of uniqueCodes) {
      const id = randomUUID();
      await connection.execute(
        `INSERT INTO promotions (
          id, event_id, name, type, discount_type, discount_value, 
          code, min_tickets, max_tickets, start_date, end_date, 
          max_usage, max_per_customer, ticket_type_ids, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.eventId,
          `${input.name} (${code})`,
          input.type,
          input.discountType,
          input.discountValue,
          code,
          input.minTickets || null,
          input.maxTickets || null,
          new Date(input.startDate),
          new Date(input.endDate),
          input.maxUsage || null,
          input.maxPerCustomer || 1,
          input.ticketTypeIds ? JSON.stringify(input.ticketTypeIds) : null,
          input.isActive !== undefined ? input.isActive : true
        ]
      );
    }
    return { success: true, count: uniqueCodes.length };
  });
}

export async function updatePromotion(id: string, input: UpdatePromotionInput) {
  await ensurePromotionsSchema();
  const existing = await getPromotion(id);
  
  if (input.code && input.code !== existing.code) {
    const codeCheck = await queryOne('SELECT id FROM promotions WHERE code = ? AND id != ?', [input.code, id]);
    if (codeCheck) throw new BadRequestError('Promo code already exists');
  }

  const updates: string[] = [];
  const values: any[] = [];

  const fields: Record<string, keyof UpdatePromotionInput> = {
    name: 'name',
    type: 'type',
    discount_type: 'discountType',
    discount_value: 'discountValue',
    code: 'code',
    min_tickets: 'minTickets',
    max_tickets: 'maxTickets',
    start_date: 'startDate',
    end_date: 'endDate',
    max_usage: 'maxUsage',
    max_per_customer: 'maxPerCustomer',
    is_active: 'isActive'
  };

  for (const [dbField, inputField] of Object.entries(fields)) {
    if (input[inputField] !== undefined) {
      updates.push(`${dbField} = ?`);
      values.push(input[inputField] === '' ? null : input[inputField]);
    }
  }

  if (input.startDate !== undefined) {
    updates.push('start_date = ?');
    values.push(new Date(input.startDate));
  }
  if (input.endDate !== undefined) {
    updates.push('end_date = ?');
    values.push(new Date(input.endDate));
  }
  if (input.ticketTypeIds !== undefined) {
    updates.push(`ticket_type_ids = ?`);
    values.push(input.ticketTypeIds ? JSON.stringify(input.ticketTypeIds) : null);
  }

  if (updates.length > 0) {
    values.push(id);
    await execute(
      `UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  return getPromotion(id);
}

export async function deletePromotion(id: string) {
  await execute('DELETE FROM promotions WHERE id = ?', [id]);
  return { success: true };
}

export async function togglePromotion(id: string) {
  const existing = await getPromotion(id);
  await execute('UPDATE promotions SET is_active = ? WHERE id = ?', [!existing.is_active, id]);
  return getPromotion(id);
}
