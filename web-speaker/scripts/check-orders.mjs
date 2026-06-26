import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Parse DATABASE_URL
function parseDbUrl(url) {
  const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);
  if (!match) throw new Error('Invalid DATABASE_URL');
  return {
    user: match[1],
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4]),
    database: match[5].split('?')[0],
  };
}

const dbConfig = parseDbUrl(process.env.DATABASE_URL);

async function checkOrders() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🔗 Connected to database');
    
    // Check orders table
    console.log('\n📋 Orders table structure:');
    const [orderCols] = await connection.execute('DESCRIBE orders');
    console.log(orderCols.map(c => `  - ${c.Field} (${c.Type})`).join('\n'));
    
    // Check order_items table
    console.log('\n📋 Order_items table structure:');
    const [itemCols] = await connection.execute('DESCRIBE order_items');
    console.log(itemCols.map(c => `  - ${c.Field} (${c.Type})`).join('\n'));
    
    // Check orders count
    const [orderCount] = await connection.execute('SELECT COUNT(*) as count FROM orders');
    console.log(`\n📊 Total orders: ${orderCount[0].count}`);
    
    // Get sample order with items
    const [orders] = await connection.execute(`
      SELECT o.id, o.order_number, o.status, o.customer_name, o.total_amount
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 3
    `);
    
    if (orders.length > 0) {
      console.log('\n📦 Sample orders:');
      for (const order of orders) {
        console.log(`  - ${order.order_number}: ${order.customer_name} - ${order.status} - ${order.total_amount}đ`);
        
        // Get order items
        const [items] = await connection.execute(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );
        
        for (const item of items) {
          console.log(`    └─ Seat: ${item.seat_number} (${item.seat_type}) - ${item.price}đ - seat_id: ${item.seat_id}`);
          
          // Check if seat exists
          const [seat] = await connection.execute(
            'SELECT id, seat_number FROM seats WHERE id = ?',
            [item.seat_id]
          );
          
          if (seat.length === 0) {
            console.log(`       ⚠️ SEAT NOT FOUND in seats table!`);
          }
        }
      }
    } else {
      console.log('\n📦 No orders found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkOrders();

