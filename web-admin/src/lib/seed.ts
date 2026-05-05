import {query} from './db'
import bcryptjs from 'bcryptjs'
import {randomUUID} from 'crypto'

/**
 * Seed default data after reset
 */
export async function seedDefaultData() {
  console.log('[SEED] Starting database seed...')

  // 1. Create roles
  console.log('[SEED] Creating roles...')
  const roles = [
    {
      id: randomUUID(),
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with full access',
      permissions: JSON.stringify(['*']),
    },
    {
      id: randomUUID(),
      name: 'ADMIN',
      description: 'Administrator with management access',
      permissions: JSON.stringify(['events.*', 'seats.*', 'orders.*']),
    },
    {
      id: randomUUID(),
      name: 'STAFF',
      description: 'Staff with limited access',
      permissions: JSON.stringify(['orders.view', 'seats.view']),
    },
    {
      id: randomUUID(),
      name: 'USER',
      description: 'Regular user/customer',
      permissions: JSON.stringify(['orders.own']),
    },
  ]

  for (const role of roles) {
    await query(
      `INSERT IGNORE INTO roles (id, name, description, permissions, created_at, updated_at) 
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [role.id, role.name, role.description, role.permissions]
    )
  }

  // Get role IDs
  const roleRows = await query<any>(`SELECT id, name FROM roles`)
  const roleMap: Record<string, string> = {}
  roleRows.forEach((r: any) => (roleMap[r.name] = r.id))

  console.log('[SEED] ✓ Roles created')

  // 2. Create admin user
  console.log('[SEED] Creating admin user...')
  const passwordHash = await bcryptjs.hash('admin123456', 10)
  const adminId = randomUUID()

  await query(
    `INSERT IGNORE INTO users (id, email, password_hash, full_name, phone_number, role_id, is_active, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      adminId,
      'admin@tedxfptuhcm.com',
      passwordHash,
      'Super Admin',
      '+84123456789',
      roleMap['SUPER_ADMIN'],
      true,
    ]
  )

  console.log('[SEED] ✓ Admin user created')

  // 3. Create email templates
  console.log('[SEED] Creating email templates...')
  const templates = [
    {
      id: randomUUID(),
      name: 'ticket_confirmation',
      subject: 'Your TEDxFPT University HCMC Ticket - {{orderCode}}',
      html_content: '<h1>Thank you for your purchase!</h1><p>Order: {{orderCode}}</p>',
      variables: JSON.stringify(['orderCode', 'customerName', 'eventName', 'seats', 'qrCode']),
    },
    {
      id: randomUUID(),
      name: 'payment_reminder',
      subject: 'Payment Reminder - Order {{orderCode}}',
      html_content:
        '<h1>Payment Reminder</h1><p>Dear {{customerName}}, please complete payment for order {{orderCode}}.</p>',
      variables: JSON.stringify(['orderCode', 'customerName', 'expiresAt']),
    },
  ]

  for (const template of templates) {
    await query(
      `INSERT IGNORE INTO email_templates (id, name, subject, html_content, variables, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        template.id,
        template.name,
        template.subject,
        template.html_content,
        template.variables,
        true,
      ]
    )
  }

  console.log('[SEED] ✓ Email templates created')

  // 4. Create a sample event (optional - can be skipped if you prefer to create manually)
  console.log('[SEED] Creating sample event...')
  const eventId = 'evt-tedx-2026'
  const eventDate = new Date('2026-03-15T00:00:00')

  await query(
    `INSERT IGNORE INTO events (id, name, slug, description, venue, event_date, doors_open_time, start_time, end_time, status, max_capacity, available_seats, banner_image_url, is_published, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [
      eventId,
      'TEDxFPTUniversityHCMC 2026: Finding Flow',
      'tedxfptuniversityhcmc-2026',
      'TEDxFPTUniversityHCMC 2026: Finding Flow brings together visionaries and innovators.',
      'FPT University HCMC',
      eventDate,
      new Date('2026-03-15T08:00:00'),
      new Date('2026-03-15T09:00:00'),
      new Date('2026-03-15T17:00:00'),
      'PUBLISHED',
      96,
      96,
      '/events/tedx-2026-banner.jpg',
      true,
    ]
  )

  console.log('[SEED] ✓ Sample event created')

  // 5. Drop and recreate ticket_types table with correct schema and UTF8MB4
  console.log('[SEED] Recreating ticket_types table...')
  await query(`DROP TABLE IF EXISTS ticket_types`)
  await query(`
    CREATE TABLE ticket_types (
      id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci PRIMARY KEY,
      event_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
      name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
      subtitle VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
      description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
      price DECIMAL(10,2) NOT NULL,
      benefits TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
      color VARCHAR(20),
      icon VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
      max_quantity INT,
      sold_quantity INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_event_id (event_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
  `)
  console.log('[SEED] ✓ ticket_types table recreated with UTF8MB4')

  // 6. Create ticket types
  console.log('[SEED] Creating ticket types...')
  const ticketTypes = [
    {
      id: randomUUID(),
      event_id: eventId,
      name: 'Early Bird',
      subtitle: 'Gia uu dai som',
      description: 'Early bird special price',
      price: 800000,
      benefits: null,
      color: '#10b981',
      icon: '🎟️',
      max_quantity: null,
      sold_quantity: 0,
      is_active: true,
      sort_order: 1,
    },
    {
      id: randomUUID(),
      event_id: eventId,
      name: 'Standard',
      subtitle: 'Ve tieu chuan',
      description: 'Standard ticket',
      price: 1500000,
      benefits: null,
      color: '#3b82f6',
      icon: '🎫',
      max_quantity: null,
      sold_quantity: 0,
      is_active: true,
      sort_order: 2,
    },
    {
      id: randomUUID(),
      event_id: eventId,
      name: 'VIP',
      subtitle: 'Ve VIP cao cap',
      description: 'VIP ticket with premium seating',
      price: 2500000,
      benefits: null,
      color: '#eab308',
      icon: '👑',
      max_quantity: null,
      sold_quantity: 0,
      is_active: true,
      sort_order: 3,
    },
  ]

  for (const ticketType of ticketTypes) {
    await query(
      `INSERT IGNORE INTO ticket_types (id, event_id, name, subtitle, description, price, benefits, color, icon, max_quantity, sold_quantity, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        ticketType.id,
        ticketType.event_id,
        ticketType.name,
        ticketType.subtitle,
        ticketType.description,
        ticketType.price,
        ticketType.benefits,
        ticketType.color,
        ticketType.icon,
        ticketType.max_quantity,
        ticketType.sold_quantity,
        ticketType.is_active,
        ticketType.sort_order,
      ]
    )
  }

  console.log('[SEED] ✓ Ticket types created')

  // 7. Create seats (10 rows x 10 seats = 100 seats)
  console.log('[SEED] Creating seats...')
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  const seatsPerRow = 10
  let seatsCreated = 0

  for (const row of rows) {
    for (let col = 1; col <= seatsPerRow; col++) {
      const seatId = randomUUID()
      const seatNumber = `${row}${col}`

      // Determine seat type and price based on row
      let seatType = 'STANDARD'
      let price = 1500000

      if (row === 'A' || row === 'B') {
        // Row A, B: VIP
        seatType = 'VIP'
        price = 2500000
      } else if (row === 'C' || row === 'D') {
        // Row C, D: ECONOMY (Early Bird pricing)
        seatType = 'ECONOMY'
        price = 800000
      }
      // Row E-J: STANDARD (default)

      await query(
        `INSERT INTO seats (id, event_id, seat_number, row, col, section, seat_type, price, status, position_x, position_y, is_disabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 0, 0, 0, NOW(), NOW())`,
        [seatId, eventId, seatNumber, row, col, 'MAIN', seatType, price]
      )
      seatsCreated++
    }
  }

  console.log(`[SEED] ✓ Created ${seatsCreated} seats (${rows.length} rows x ${seatsPerRow} seats)`)

  // 8. Update event available_seats count
  await query(`UPDATE events SET available_seats = ?, max_capacity = ? WHERE id = ?`, [
    seatsCreated,
    seatsCreated,
    eventId,
  ])
  console.log('[SEED] ✓ Updated event capacity')

  console.log('[SEED] ✅ Seed completed!')

  return {
    rolesCount: roles.length,
    adminEmail: 'admin@tedxfptuhcm.com',
    templatesCount: templates.length,
    ticketTypesCount: ticketTypes.length,
    seatsCreated,
    eventId,
  }
}
