import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '202.92.4.66',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'jyndyeeuhosting_easyticketdb',
  password: process.env.DB_PASSWORD || 'Easyticket@2026',
  database: process.env.DB_NAME || 'jyndyeeuhosting_easyticketdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

export async function execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

// Helper types
export interface Seat {
  id: string;
  event_id: string;
  seat_number: string;
  row: string;
  col: number;
  section: string;
  seat_type: 'VIP' | 'STANDARD' | 'ECONOMY';
  price: number;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'LOCKED';
  position_x: number | null;
  position_y: number | null;
  is_disabled: boolean;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  venue: string;
  event_date: Date;
  doors_open_time: Date;
  start_time: Date;
  end_time: Date;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
  max_capacity: number;
  available_seats: number;
  banner_image_url: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
}

export interface TicketType {
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
  sold_quantity: number;
  is_active: boolean;
  sort_order: number;
}

