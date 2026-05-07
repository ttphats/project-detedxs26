import { getPool } from '../../db/mysql.js';
import { RowDataPacket } from 'mysql2';

interface Customer extends RowDataPacket {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  event_id: string;
  event_name: string;
  total_amount: number;
  seat_count: number;
  seat_numbers: string;
  status: string;
  checked_in: boolean;
  checked_in_at: Date | null;
  checked_in_by: string | null;
  checked_in_by_name: string | null;
  created_at: Date;
  paid_at: Date | null;
}

interface Event extends RowDataPacket {
  id: string;
  name: string;
}

/**
 * List all customers (from PAID orders)
 */
export async function listCustomers(eventId?: string, search?: string) {
  const pool = getPool();

  let sql = `
    SELECT
      o.id,
      o.order_number,
      o.customer_name,
      o.customer_email,
      o.customer_phone,
      o.event_id,
      e.name as event_name,
      o.total_amount,
      o.status,
      o.checked_in_at,
      o.checked_in_by,
      u.full_name as checked_in_by_name,
      o.created_at,
      o.paid_at,
      (o.checked_in_at IS NOT NULL) as checked_in,
      COUNT(oi.id) as seat_count,
      GROUP_CONCAT(oi.seat_number ORDER BY oi.seat_number SEPARATOR ', ') as seat_numbers
    FROM orders o
    JOIN events e ON o.event_id = e.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN users u ON o.checked_in_by = u.id
    WHERE o.status = 'PAID'
  `;

  const params: any[] = [];

  if (eventId) {
    sql += ' AND o.event_id = ?';
    params.push(eventId);
  }

  if (search) {
    sql += ` AND (
      o.customer_name LIKE ? OR 
      o.customer_email LIKE ? OR 
      o.customer_phone LIKE ? OR
      o.order_number LIKE ?
    )`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  sql += ' GROUP BY o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone, o.event_id, e.name, o.total_amount, o.status, o.checked_in_at, o.checked_in_by, u.full_name, o.created_at, o.paid_at';
  sql += ' ORDER BY o.created_at DESC';

  const [customers] = await pool.query<Customer[]>(sql, params);

  // Get all events for filter dropdown
  const [events] = await pool.query<Event[]>(
    'SELECT id, name FROM events ORDER BY event_date DESC'
  );

  // Calculate stats
  const stats = {
    total: customers.length,
    checkedIn: customers.filter(c => c.checked_in).length,
    pending: customers.filter(c => !c.checked_in).length,
  };

  return {
    customers,
    events,
    stats,
  };
}

/**
 * Get customer details by order ID
 */
export async function getCustomerByOrderId(orderId: string) {
  const pool = getPool();

  const [orders] = await pool.query<Customer[]>(
    `SELECT 
      o.id,
      o.order_number,
      o.customer_name,
      o.customer_email,
      o.customer_phone,
      o.event_id,
      e.name as event_name,
      o.total_amount,
      o.status,
      o.checked_in_at,
      o.checked_in_by,
      o.created_at,
      o.paid_at,
      o.qr_code_url,
      (o.checked_in_at IS NOT NULL) as checked_in
    FROM orders o
    JOIN events e ON o.event_id = e.id
    WHERE o.id = ?`,
    [orderId]
  );

  if (orders.length === 0) {
    return null;
  }

  const customer = orders[0];

  // Get order items (seats)
  const [items] = await pool.query<any[]>(
    `SELECT id, seat_number, seat_type, price FROM order_items WHERE order_id = ?`,
    [orderId]
  );

  return {
    ...customer,
    seats: items,
  };
}
