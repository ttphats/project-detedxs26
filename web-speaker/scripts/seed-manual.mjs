import mysql from 'mysql2/promise';
import bcryptjs from 'bcryptjs';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// Load .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const eqIndex = line.indexOf('=');
  const key = line.slice(0, eqIndex).trim();
  let value = line.slice(eqIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
};

console.log('🔌 Connecting to database...');
const connection = await mysql.createConnection(config);
console.log('✅ Connected!\n');

// Create remaining tables
console.log('📦 Creating remaining tables...');

await connection.execute(`
  CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    seat_id VARCHAR(36) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    seat_number VARCHAR(50) NOT NULL,
    seat_type VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_seat_id (seat_id),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id)
  )
`);

await connection.execute(`
  CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) UNIQUE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    transaction_id VARCHAR(255) UNIQUE,
    payment_gateway VARCHAR(50),
    payment_session_id VARCHAR(255) UNIQUE,
    payment_proof VARCHAR(500),
    webhook_received BOOLEAN DEFAULT FALSE,
    webhook_processed BOOLEAN DEFAULT FALSE,
    webhook_data TEXT,
    paid_at DATETIME,
    refunded_at DATETIME,
    refund_reason TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )
`);

await connection.execute(`
  CREATE TABLE IF NOT EXISTS email_templates (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);

await connection.execute(`
  CREATE TABLE IF NOT EXISTS email_logs (
    id VARCHAR(36) PRIMARY KEY,
    \`to\` VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    provider VARCHAR(50),
    provider_id VARCHAR(255),
    error TEXT,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_to (\`to\`),
    INDEX idx_status (status)
  )
`);

await connection.execute(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(36),
    changes TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);

console.log('✅ All tables created!\n');

// Seed data
console.log('🌱 Seeding data...');

// Create roles
const superAdminRoleId = randomUUID();
const adminRoleId = randomUUID();
const staffRoleId = randomUUID();
const userRoleId = randomUUID();

await connection.execute(
  `INSERT IGNORE INTO roles (id, name, description, permissions) VALUES (?, ?, ?, ?)`,
  [superAdminRoleId, 'SUPER_ADMIN', 'Super Administrator with full access', JSON.stringify(['*'])]
);
await connection.execute(
  `INSERT IGNORE INTO roles (id, name, description, permissions) VALUES (?, ?, ?, ?)`,
  [adminRoleId, 'ADMIN', 'Administrator', JSON.stringify(['events.*', 'orders.*'])]
);
await connection.execute(
  `INSERT IGNORE INTO roles (id, name, description, permissions) VALUES (?, ?, ?, ?)`,
  [staffRoleId, 'STAFF', 'Staff member', JSON.stringify(['orders.read', 'events.read'])]
);
await connection.execute(
  `INSERT IGNORE INTO roles (id, name, description, permissions) VALUES (?, ?, ?, ?)`,
  [userRoleId, 'USER', 'Regular user', JSON.stringify(['orders.own'])]
);
console.log('✅ Roles created');

// Get actual role IDs (in case they already existed)
const [roles] = await connection.execute(`SELECT id, name FROM roles`);
const roleMap = {};
roles.forEach(r => roleMap[r.name] = r.id);

// Create super admin user
const passwordHash = await bcryptjs.hash('admin123456', 10);
const adminId = randomUUID();
await connection.execute(
  `INSERT IGNORE INTO users (id, email, password_hash, full_name, phone_number, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [adminId, 'admin@tedxfptuhcm.com', passwordHash, 'Super Admin', '+84123456789', roleMap['SUPER_ADMIN'], true]
);
console.log('✅ Super admin created: admin@tedxfptuhcm.com / admin123456');

// ============================================
// MOCKDATA FROM WEB-CLIENT
// ============================================

const tedxSpeakers = [
  { id: 's1', name: 'Dr. Nguyen Thi Mai', title: 'AI Research Director', company: 'VinAI Research', bio: 'Leading AI researcher with 15+ years of experience.', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop', topic: 'The Future of AI in Southeast Asia' },
  { id: 's2', name: 'Tran Minh Duc', title: 'Founder & CEO', company: 'EcoVietnam', bio: 'Social entrepreneur revolutionizing sustainable agriculture.', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', topic: 'Reimagining Agriculture for Climate Resilience' },
  { id: 's3', name: 'Le Hoang Anh', title: 'Bestselling Author', company: 'Independent', bio: 'Bestselling author exploring Vietnamese identity.', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', topic: 'Stories That Connect Us' },
  { id: 's4', name: 'Prof. Pham Van Tuan', title: 'Professor of Quantum Physics', company: 'Vietnam National University', bio: 'Pioneering researcher in quantum computing.', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', topic: 'Quantum Leap: Computing Beyond Limits' },
];

const tedxTimeline = [
  { id: 't1', time: '08:30', title: 'Registration & Welcome Coffee', description: 'Check-in and networking', type: 'networking' },
  { id: 't2', time: '09:00', title: 'Opening Ceremony', description: 'Welcome address and introduction', type: 'talk' },
  { id: 't3', time: '09:30', title: 'The Future of AI in Southeast Asia', description: 'Keynote by Dr. Nguyen Thi Mai', type: 'talk', speakerId: 's1' },
  { id: 't4', time: '10:00', title: 'Reimagining Agriculture', description: 'Talk by Tran Minh Duc', type: 'talk', speakerId: 's2' },
  { id: 't5', time: '10:30', title: 'Coffee Break', description: 'Refreshments and networking', type: 'break' },
  { id: 't6', time: '11:00', title: 'Stories That Connect Us', description: 'Talk by Le Hoang Anh', type: 'talk', speakerId: 's3' },
  { id: 't7', time: '11:30', title: 'Quantum Leap', description: 'Talk by Prof. Pham Van Tuan', type: 'talk', speakerId: 's4' },
  { id: 't8', time: '12:00', title: 'Lunch Break', description: 'Networking lunch with speakers', type: 'break' },
  { id: 't9', time: '14:00', title: 'Musical Performance', description: 'Live performance by local artists', type: 'performance' },
  { id: 't10', time: '14:30', title: 'Panel Discussion', description: 'Innovation in Vietnam', type: 'talk' },
  { id: 't11', time: '15:30', title: 'Networking Session', description: 'Connect with speakers and attendees', type: 'networking' },
  { id: 't12', time: '17:00', title: 'Closing Ceremony', description: 'Wrap-up and photo session', type: 'talk' },
];

const soldSeats = ['A3', 'A4', 'B5', 'B6', 'C7', 'D2', 'E8', 'F1', 'G10', 'H5', 'H6'];

// Create Events
// Note: Only 1 event can have is_published=true at a time (hosted on client)
console.log('\n📅 Creating events...');

// Event 1: Currently PUBLISHED (hosted on client)
const eventId = 'evt-tedx-2026';
const eventDate = new Date('2026-03-15T00:00:00');
await connection.execute(
  `INSERT IGNORE INTO events (id, name, slug, description, venue, event_date, doors_open_time, start_time, end_time, status, max_capacity, available_seats, banner_image_url, is_published, published_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [eventId, 'TEDxFPTUniversityHCMC 2026: Finding Flow', 'tedxfptuniversityhcmc-2026',
   'TEDxFPTUniversityHCMC 2026: Finding Flow brings together visionaries, innovators, and change-makers to share groundbreaking ideas about achieving flow states in work, creativity, and life.',
   'FPT University HCMC Campus', eventDate, new Date('2026-03-15T08:00:00'), new Date('2026-03-15T08:30:00'), new Date('2026-03-15T18:00:00'),
   'PUBLISHED', 500, 96 - soldSeats.length, 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1920&h=1080&fit=crop', true]
);
console.log('  ✅ TEDxFPTUniversityHCMC 2026 (PUBLISHED - hosted on client)');

// Event 2: DRAFT (for future, not published yet)
const event2Id = 'evt-tedxyouth-2026';
const event2Date = new Date('2026-04-20T00:00:00');
await connection.execute(
  `INSERT IGNORE INTO events (id, name, slug, description, venue, event_date, doors_open_time, start_time, end_time, status, max_capacity, available_seats, banner_image_url, is_published, published_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(), NOW())`,
  [event2Id, 'TEDxYouth@Saigon 2026', 'tedxyouth-saigon-2026',
   'Empowering the next generation of thinkers and leaders. TEDxYouth@Saigon celebrates young voices with fresh perspectives on technology, creativity, and social change.',
   'RMIT University Vietnam', event2Date, new Date('2026-04-20T08:30:00'), new Date('2026-04-20T09:00:00'), new Date('2026-04-20T16:00:00'),
   'DRAFT', 300, 96, 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1920&h=1080&fit=crop', false]
);
console.log('  ✅ TEDxYouth@Saigon 2026 (DRAFT - not published)');

// Create Seat Layout with speakers & timeline
console.log('\n🪑 Creating seat layout...');

const layoutData = {
  rows: ['A','B','C','D','E','F','G','H'],
  seatsPerRow: 12,
  ticketTypes: [
    { id: 'vip', name: 'VIP Experience', price: 2500000, description: 'Premium seating, Speaker meet & greet, Exclusive dinner' },
    { id: 'standard', name: 'Standard Pass', price: 1500000, description: 'General admission, All talks access, Lunch included' }
  ],
  speakers: tedxSpeakers,
  timeline: tedxTimeline
};

await connection.execute(
  `INSERT IGNORE INTO seat_layouts (id, event_id, name, layout_data, total_seats, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [randomUUID(), eventId, 'Main Hall', JSON.stringify(layoutData), 96, true]
);
console.log('  ✅ Seat layout created with speakers & timeline');

// Create Seats (8 rows x 12 seats = 96 total)
console.log('\n🎫 Creating seats...');
const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const seatsPerRow = 12;
const vipPrice = 2500000;
const stdPrice = 1500000;

for (const row of rowLabels) {
  for (let i = 1; i <= seatsPerRow; i++) {
    const seatNumber = `${row}${i}`;
    const isVIP = ['A', 'B'].includes(row);
    const isSold = soldSeats.includes(seatNumber);

    await connection.execute(
      `INSERT IGNORE INTO seats (id, event_id, seat_number, row, col, section, seat_type, price, status, position_x, position_y, is_disabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [randomUUID(), eventId, seatNumber, row, String(i), 'MAIN', isVIP ? 'VIP' : 'STANDARD', isVIP ? vipPrice : stdPrice, isSold ? 'SOLD' : 'AVAILABLE', i * 50, rowLabels.indexOf(row) * 50, false]
    );
  }
}
console.log('  ✅ 96 seats created (VIP: rows A-B, Standard: rows C-H)');

// Create sample orders
console.log('\n📦 Creating sample orders...');

// Order 1: Nguyen Van A - 2 VIP seats (A1, A2) - PAID
const order1Id = randomUUID();
await connection.execute(
  `INSERT IGNORE INTO orders (id, order_number, event_id, total_amount, status, customer_email, customer_name, customer_phone, paid_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [order1Id, 'ORD-2026-001', eventId, 5000000, 'PAID', 'nguyenvana@email.com', 'Nguyen Van A', '0901234567']
);

const [seatsA1A2] = await connection.execute(`SELECT id, seat_number FROM seats WHERE event_id = ? AND seat_number IN ('A1', 'A2')`, [eventId]);
for (const seat of seatsA1A2) {
  await connection.execute(`INSERT IGNORE INTO order_items (id, order_id, seat_id, price, seat_number, seat_type, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [randomUUID(), order1Id, seat.id, 2500000, seat.seat_number, 'VIP']);
  await connection.execute(`UPDATE seats SET status = 'SOLD' WHERE id = ?`, [seat.id]);
}
await connection.execute(`INSERT IGNORE INTO payments (id, order_id, payment_method, amount, status, transaction_id, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [randomUUID(), order1Id, 'BANK_TRANSFER', 5000000, 'COMPLETED', 'TXN-001']);
console.log('  ✅ ORD-2026-001 (Nguyen Van A - 2 VIP)');

// Order 2: Tran Thi B - 1 Standard seat (C5) - PAID
const order2Id = randomUUID();
await connection.execute(
  `INSERT IGNORE INTO orders (id, order_number, event_id, total_amount, status, customer_email, customer_name, customer_phone, paid_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [order2Id, 'ORD-2026-002', eventId, 1500000, 'PAID', 'tranthib@email.com', 'Tran Thi B', '0912345678']
);

const [seatC5] = await connection.execute(`SELECT id FROM seats WHERE event_id = ? AND seat_number = 'C5'`, [eventId]);
if (seatC5.length > 0) {
  await connection.execute(`INSERT IGNORE INTO order_items (id, order_id, seat_id, price, seat_number, seat_type, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [randomUUID(), order2Id, seatC5[0].id, 1500000, 'C5', 'STANDARD']);
  await connection.execute(`UPDATE seats SET status = 'SOLD' WHERE id = ?`, [seatC5[0].id]);
}
await connection.execute(`INSERT IGNORE INTO payments (id, order_id, payment_method, amount, status, transaction_id, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [randomUUID(), order2Id, 'BANK_TRANSFER', 1500000, 'COMPLETED', 'TXN-002']);
console.log('  ✅ ORD-2026-002 (Tran Thi B - 1 Standard)');

// Order 3: Le Van C - 1 Standard seat (D5) - PENDING
const order3Id = randomUUID();
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 24);
await connection.execute(
  `INSERT IGNORE INTO orders (id, order_number, event_id, total_amount, status, customer_email, customer_name, customer_phone, expires_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [order3Id, 'ORD-2026-003', eventId, 1500000, 'PENDING', 'levanc@email.com', 'Le Van C', '0923456789', expiresAt]
);

const [seatD5] = await connection.execute(`SELECT id FROM seats WHERE event_id = ? AND seat_number = 'D5'`, [eventId]);
if (seatD5.length > 0) {
  await connection.execute(`INSERT IGNORE INTO order_items (id, order_id, seat_id, price, seat_number, seat_type, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [randomUUID(), order3Id, seatD5[0].id, 1500000, 'D5', 'STANDARD']);
  await connection.execute(`UPDATE seats SET status = 'RESERVED' WHERE id = ?`, [seatD5[0].id]);
}
await connection.execute(`INSERT IGNORE INTO payments (id, order_id, payment_method, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
  [randomUUID(), order3Id, 'BANK_TRANSFER', 1500000, 'PENDING']);
console.log('  ✅ ORD-2026-003 (Le Van C - PENDING)');

// Create email templates
console.log('\n📧 Creating email templates...');
await connection.execute(
  `INSERT IGNORE INTO email_templates (id, name, subject, html_content, variables, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [randomUUID(), 'ticket_confirmation', 'Your TEDxFPT University HCMC Ticket - {{orderCode}}',
   '<div style="font-family:Arial;max-width:600px;margin:0 auto"><div style="background:#e62b1e;padding:20px;text-align:center"><h1 style="color:white;margin:0">TEDx<span style="font-weight:normal">FPTUniversityHCMC</span></h1></div><div style="padding:30px;background:#f9f9f9"><h2>Thank you for your purchase, {{customerName}}!</h2><p>Order: <strong>{{orderCode}}</strong></p><p>Event: {{eventName}}</p><p>Seats: {{seats}}</p><p>Total: {{totalAmount}} VND</p><div style="text-align:center;margin:30px 0"><img src="{{qrCode}}" alt="QR Code" style="max-width:200px"/></div></div></div>',
   JSON.stringify(['orderCode', 'customerName', 'eventName', 'seats', 'totalAmount', 'qrCode']), true]
);
await connection.execute(
  `INSERT IGNORE INTO email_templates (id, name, subject, html_content, variables, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [randomUUID(), 'payment_reminder', 'Payment Reminder - Order {{orderCode}}',
   '<h1>Payment Reminder</h1><p>Dear {{customerName}}, please complete payment for order {{orderCode}} before {{expiresAt}}.</p>',
   JSON.stringify(['orderCode', 'customerName', 'expiresAt']), true]
);
console.log('  ✅ Email templates created');

await connection.end();

console.log('\n🎉 Seed completed!');
console.log('\n📊 Summary:');
console.log('   - 4 Roles');
console.log('   - 1 Super Admin (admin@tedxfptuhcm.com / admin123456)');
console.log('   - 2 Events:');
console.log('     • TEDxFPTUniversityHCMC 2026 (PUBLISHED - hosted on client)');
console.log('     • TEDxYouth@Saigon 2026 (DRAFT - not published)');
console.log('   - 96 Seats for main event (VIP: A-B, Standard: C-H)');
console.log('   - 3 Sample Orders (2 PAID, 1 PENDING)');
console.log('   - 2 Email Templates');
console.log('\n💡 Note: Only 1 event can be published at a time. Toggle is_published to switch.');

