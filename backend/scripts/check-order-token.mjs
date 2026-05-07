import mysql from 'mysql2/promise';
import crypto from 'crypto';

const ORDER_NUMBER = 'TKHNH9VFB';
const TOKEN = '0f41c0e05e746d2836c8899900e2e3b2ef4512bb839dae042f41ee346390c024';

async function checkOrder() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123123',
    database: 'tedx_db'
  });

  try {
    console.log(`\n🔍 Checking order: ${ORDER_NUMBER}\n`);

    // Get order details
    const [orders] = await connection.execute(
      `SELECT order_number, status, customer_name, customer_email, customer_phone,
              access_token_hash, qr_code_url, created_at, updated_at
       FROM orders WHERE order_number = ?`,
      [ORDER_NUMBER]
    );

    if (orders.length === 0) {
      console.log('❌ Order not found');
      return;
    }

    const order = orders[0];
    console.log('📦 Order Details:');
    console.log('  Order Number:', order.order_number);
    console.log('  Status:', order.status);
    console.log('  Customer:', order.customer_name);
    console.log('  Email:', order.customer_email);
    console.log('  Phone:', order.customer_phone);
    console.log('  QR Code URL:', order.qr_code_url || 'NOT SET');
    console.log('  Created:', order.created_at);
    console.log('  Updated:', order.updated_at);

    console.log('\n🔐 Token Verification:');
    console.log('  Provided Token:', TOKEN.substring(0, 20) + '...');
    console.log('  Token Length:', TOKEN.length);

    if (order.access_token_hash) {
      console.log('  Stored Hash:', order.access_token_hash.substring(0, 20) + '...');
      console.log('  Hash Length:', order.access_token_hash.length);

      // Verify token
      const hash = crypto.createHash('sha256').update(TOKEN).digest('hex');
      console.log('  Computed Hash:', hash.substring(0, 20) + '...');
      console.log('  Match:', hash === order.access_token_hash ? '✅ YES' : '❌ NO');
    } else {
      console.log('  ❌ NO ACCESS TOKEN HASH STORED!');
    }

    // Check email logs
    const [emailLogs] = await connection.execute(
      `SELECT id, purpose, recipient, subject, status, provider_response, sent_at, created_at
       FROM email_logs
       WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)
       ORDER BY created_at DESC`,
      [ORDER_NUMBER]
    );

    console.log('\n📧 Email Logs:');
    if (emailLogs.length === 0) {
      console.log('  ❌ NO EMAILS SENT FOR THIS ORDER');
    } else {
      for (const log of emailLogs) {
        console.log(`\n  Email #${log.id}:`);
        console.log('    Purpose:', log.purpose);
        console.log('    To:', log.recipient);
        console.log('    Subject:', log.subject);
        console.log('    Status:', log.status);
        console.log('    Provider Response:', log.provider_response || 'N/A');
        console.log('    Sent At:', log.sent_at || 'NOT SENT');
        console.log('    Created:', log.created_at);
      }
    }

  } finally {
    await connection.end();
  }
}

checkOrder().catch(console.error);
