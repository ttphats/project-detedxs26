import mysql from 'mysql2/promise';

const dbConfig = {
  host: '202.92.4.66',
  port: 3306,
  user: 'jyndyeeuhosting_easyticketdb',
  password: 'Easyticket@2026',
  database: 'jyndyeeuhosting_easyticketdb',
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
  section_code: string | null;
  seat_key: string | null;
  seat_type: 'VIP' | 'STANDARD' | 'ECONOMY';
  price: number;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'LOCKED' | 'REMOVED';
  position_x: number | null;
  position_y: number | null;
  is_disabled: boolean;
  locked_until: Date | null;
  locked_by_session: string | null;
  layout_id: string | null;
  section_id: string | null;
  order_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
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
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  color: string;
  icon: string;
  max_quantity: number | null;
  sold_quantity: number;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface Layout {
  id: string;
  event_id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'PUBLIC' | 'ARCHIVED';
  canvas_width: number;
  canvas_height: number;
  created_at: Date;
  updated_at: Date;
  sections?: LayoutSection[]; // For joined queries
}

export interface LayoutSection {
  id: string;
  layout_id: string;
  section_code: string;
  name: string;
  rows_count: number;
  cols_count: number;
  seat_count: number | null;
  seat_type: 'VIP' | 'STANDARD' | 'ECONOMY';
  price: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

// Seat comparison types for publish algorithm
export interface GeneratedSeat {
  section_code: string;
  row: string;
  col: number;
  seat_key: string;
  seat_number: string;
  seat_type: 'VIP' | 'STANDARD' | 'ECONOMY';
  price: number;
}

export interface SeatComparisonResult {
  toKeep: Seat[];      // Seats that exist in both old and new
  toRemove: Seat[];    // Seats in old but not in new (mark as REMOVED if BOOKED/HOLD)
  toAdd: GeneratedSeat[]; // Seats in new but not in old (insert as AVAILABLE)
}
