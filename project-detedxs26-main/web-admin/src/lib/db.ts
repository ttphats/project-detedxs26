import mysql from 'mysql2/promise'

const dbConfig = {
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig)
  }
  return pool
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getPool()
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] || null
}

export async function execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
  const pool = getPool()
  const [result] = await pool.execute(sql, params)
  return result as mysql.ResultSetHeader
}

// Helper types
export interface EmailTemplate {
  id: string
  name: string
  subject: string
  html_content: string
  text_content: string | null
  variables: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Event {
  id: string
  name: string
  slug: string
  description: string | null
  venue: string
  event_date: Date
  doors_open_time: Date
  start_time: Date
  end_time: Date
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  max_capacity: number
  available_seats: number
  banner_image_url: string | null
  thumbnail_url: string | null
  is_published: boolean
  published_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface TicketType {
  id: string
  event_id: string
  name: string
  description: string | null
  price: number
  color: string
  icon: string
  max_quantity: number | null
  sold_quantity: number
  is_active: boolean
  sort_order: number
  created_at: Date
  updated_at: Date
}

export interface Layout {
  id: string
  event_id: string
  name: string
  version: number
  status: 'DRAFT' | 'PUBLIC' | 'ARCHIVED'
  canvas_width: number
  canvas_height: number
  created_at: Date
  updated_at: Date
  sections?: LayoutSection[] // For joined queries
}

export interface LayoutSection {
  id: string
  layout_id: string
  section_code: string
  name: string
  rows_count: number
  cols_count: number
  seat_count: number | null
  seat_type: 'VIP' | 'STANDARD' | 'ECONOMY'
  price: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  sort_order: number
  created_at: Date
  updated_at: Date
}

export interface EventTimeline {
  id: string
  event_id: string
  start_time: string // HH:mm format
  end_time: string // HH:mm format
  title: string
  description: string | null
  speaker_name: string | null
  speaker_avatar_url: string | null
  type: 'TALK' | 'BREAK' | 'CHECKIN' | 'OTHER'
  order_index: number
  status: 'DRAFT' | 'PUBLISHED'
  created_at: Date
  updated_at: Date
}
