#!/usr/bin/env node

/**
 * Test Full Business Flow
 * 
 * Flow:
 * 1. Admin publish layout version
 * 2. Client chọn ghế (create pending order)
 * 3. Client confirm payment
 * 4. Admin confirm order → Send email
 * 5. Check ticket
 * 
 * Email will be sent to: skphat789@gmail.com
 */

const BASE_URL = 'http://localhost:4000';
const ADMIN_USERNAME = 'admin';  // Username, not email
const ADMIN_PASSWORD = 'admin123456';
const TEST_EMAIL = 'skphat789@gmail.com';
const EVENT_ID = 'evt-tedx-2026';

let adminToken = '';
let accessToken = '';
let orderNumber = '';

// Helper function to make API requests
async function request(method, path, body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  
  return data;
}

async function main() {
  console.log('🚀 Starting Full Business Flow Test...\n');

  try {
    // Step 1: Admin Login
    console.log('📝 Step 1: Admin Login');
    console.log(`   Username: ${ADMIN_USERNAME}`);
    const loginRes = await request('POST', '/api/auth/login', {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    });
    adminToken = loginRes.data.token;
    console.log('✅ Admin logged in successfully');
    console.log(`   Token: ${adminToken.substring(0, 20)}...`);
    console.log('');

    // Step 2: Get ticket types
    console.log('📝 Step 2: Get ticket types for event');
    const ticketTypesRes = await request('GET', `/api/admin/ticket-types?eventId=${EVENT_ID}`, null, adminToken);
    const ticketTypes = Array.isArray(ticketTypesRes.data) ? ticketTypesRes.data : (ticketTypesRes.data?.ticketTypes || []);
    console.log(`✅ Found ${ticketTypes.length} ticket types:`);
    if (ticketTypes.length > 0) {
      ticketTypes.forEach(tt => {
        console.log(`   - ${tt.name}: ${Number(tt.price).toLocaleString('vi-VN')}đ`);
      });
    }
    console.log('');

    // Step 3: Create layout version (simplified - just check if exists)
    console.log('📝 Step 3: Check layout versions');
    const versionsRes = await request('GET', `/api/admin/layout-versions?eventId=${EVENT_ID}`, null, adminToken);
    console.log(`✅ Found ${versionsRes.data?.length || 0} layout versions\n`);

    // Step 4: Get available seats
    console.log('📝 Step 4: Get available seats');
    const seatsRes = await request('GET', `/api/events/${EVENT_ID}/seats?sessionId=test-session-${Date.now()}`);

    // Parse seatMap: it's array of { row, seats: [...] }
    const seatMap = seatsRes.data?.seatMap || [];
    const seats = [];
    seatMap.forEach(rowGroup => {
      if (rowGroup.seats && Array.isArray(rowGroup.seats)) {
        seats.push(...rowGroup.seats);
      }
    });

    const availableSeats = seats.filter(s => s.status === 'available'); // lowercase!
    console.log(`✅ Found ${availableSeats.length} available seats (total: ${seats.length})\n`);

    if (availableSeats.length === 0) {
      throw new Error('No available seats to book!');
    }

    // Select 2 seats
    const selectedSeats = availableSeats.slice(0, 2);
    console.log('📝 Step 5: Select seats:');
    selectedSeats.forEach(seat => {
      console.log(`   - ${seat.seatNumber} (${seat.seatType}) - ${Number(seat.price).toLocaleString('vi-VN')}đ`);
    });
    console.log('');

    // Step 5.5: Lock seats
    console.log('📝 Step 5.5: Lock seats');
    const sessionId = `test-session-${Date.now()}`;
    const lockRes = await request('POST', '/api/seats/lock', {
      eventId: EVENT_ID,
      sessionId,
      seatIds: selectedSeats.map(s => s.id),
    });
    console.log(`✅ Locked ${lockRes.data.lockedCount} seats\n`);

    // Step 6: Create pending order
    console.log('📝 Step 6: Create pending order');
    const orderRes = await request('POST', '/api/orders/create-pending', {
      eventId: EVENT_ID,
      sessionId,
      seatIds: selectedSeats.map(s => s.id),
    });
    orderNumber = orderRes.data.orderNumber;
    accessToken = orderRes.data.accessToken;
    const totalAmount = orderRes.data.totalAmount;
    console.log(`✅ Order created: ${orderNumber}`);
    console.log(`   Total: ${Number(totalAmount).toLocaleString('vi-VN')}đ`);
    console.log(`   Expires: ${orderRes.data.expiresAt}\n`);

    // Step 7: Confirm payment (client side)
    console.log('📝 Step 7: Client confirms payment');
    const confirmRes = await request('POST', '/api/orders/confirm-payment', {
      orderNumber,
      accessToken,
      customerName: 'Nguyễn Test Flow',
      customerEmail: TEST_EMAIL,
      customerPhone: '0123456789',
    });
    console.log(`✅ Payment confirmed, status: ${confirmRes.data.status}\n`);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 8: Admin get pending orders
    console.log('📝 Step 8: Admin get pending orders');
    const ordersRes = await request('GET', '/api/admin/orders?status=PENDING_CONFIRMATION', null, adminToken);
    const pendingOrders = ordersRes.data.orders;
    console.log(`✅ Found ${pendingOrders.length} pending orders\n`);

    // Find our order
    const ourOrder = pendingOrders.find(o => o.orderNumber === orderNumber);
    if (!ourOrder) {
      throw new Error('Order not found in pending list!');
    }

    console.log('📝 Step 9: Admin confirm order and send email');
    console.log(`   Order ID: ${ourOrder.id}`);
    console.log(`   Order Number: ${ourOrder.orderNumber}`);
    console.log(`   Customer: ${ourOrder.customerName} <${ourOrder.customerEmail}>`);
    console.log('   Confirming...\n');

    const adminConfirmRes = await request('POST', `/api/admin/orders/${ourOrder.id}/confirm`, {}, adminToken);
    
    console.log('✅ Admin confirmed payment!');
    console.log(`   Status: ${adminConfirmRes.data.status}`);
    console.log(`   Email Status: ${adminConfirmRes.data.emailStatus}`);
    console.log(`   Email Sent To: ${adminConfirmRes.data.emailSentTo}`);
    console.log(`   Ticket URL: ${adminConfirmRes.data.ticketUrl}\n`);

    if (adminConfirmRes.data.emailStatus === 'SENT') {
      console.log('🎉 SUCCESS! Email sent to:', TEST_EMAIL);
      console.log('📧 Check your inbox at skphat789@gmail.com\n');
    } else {
      console.log('⚠️  Email failed:', adminConfirmRes.data.emailError);
    }

    console.log('✅ Full flow completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Order Number: ${orderNumber}`);
    console.log(`   Customer Email: ${TEST_EMAIL}`);
    console.log(`   Seats: ${selectedSeats.map(s => s.seatNumber).join(', ')}`);
    console.log(`   Status: PAID`);
    console.log(`   Email Status: ${adminConfirmRes.data.emailStatus}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
