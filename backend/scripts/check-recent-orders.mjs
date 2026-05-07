import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function checkRecentOrders() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123123',
    database: process.env.DB_NAME || 'tedx_db',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    console.log('🔍 Checking all orders...\n');

    const [orders] = await pool.query(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.total_amount,
        o.created_at,
        o.updated_at,
        o.expires_at,
        (o.expires_at < NOW()) as is_expired,
        COUNT(oi.id) as seat_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 20
    `);

    if (orders.length === 0) {
      console.log('❌ No orders found in database.\n');
    } else {
      console.log(`📦 Found ${orders.length} recent orders:\n`);
      for (const order of orders) {
        console.log(`Order: ${order.order_number}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Customer: ${order.customer_name || 'Not set'}`);
        console.log(`  Email: ${order.customer_email || 'Not set'}`);
        console.log(`  Phone: ${order.customer_phone || 'Not set'}`);
        console.log(`  Amount: ${order.total_amount.toLocaleString('vi-VN')}₫`);
        console.log(`  Seats: ${order.seat_count}`);
        console.log(`  Created: ${order.created_at}`);
        console.log(`  Expires: ${order.expires_at || 'N/A'}`);
        console.log(`  Is Expired: ${order.is_expired ? 'YES ⏰' : 'NO ✅'}`);
        console.log('');
      }
    }

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkRecentOrders();
