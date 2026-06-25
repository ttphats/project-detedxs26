import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create roles
  console.log('Creating roles...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with full access',
      permissions: JSON.stringify(['*']),
    },
  });

  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator with management access',
      permissions: JSON.stringify(['events.*', 'seats.*', 'orders.*', 'emails.*']),
    },
  });

  await prisma.role.upsert({
    where: { name: 'STAFF' },
    update: {},
    create: {
      name: 'STAFF',
      description: 'Staff with limited access',
      permissions: JSON.stringify(['orders.read', 'events.read']),
    },
  });

  await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      description: 'Regular user',
      permissions: JSON.stringify(['orders.own']),
    },
  });

  console.log('✅ Roles created');

  // Create super admin user
  console.log('Creating super admin user...');
  const passwordHash = await bcryptjs.hash('admin123456', 10);

  await prisma.user.upsert({
    where: { email: 'admin@tedxfptuhcm.com' },
    update: {},
    create: {
      email: 'admin@tedxfptuhcm.com',
      passwordHash,
      fullName: 'Super Admin',
      phoneNumber: '+84123456789',
      roleId: superAdminRole.id,
      isActive: true,
    },
  });

  console.log('✅ Super admin created');
  console.log('   Email: admin@tedxfptuhcm.com');
  console.log('   Password: admin123456');

  // Create email template
  console.log('Creating email templates...');
  await prisma.emailTemplate.upsert({
    where: { name: 'ticket_confirmation' },
    update: {},
    create: {
      name: 'ticket_confirmation',
      subject: 'Your TEDxFPT University HCMC Ticket - {{orderCode}}',
      htmlContent: `<h1>Thank you for your purchase!</h1><p>Order: {{orderCode}}</p>`,
      variables: JSON.stringify(['orderCode', 'customerName', 'eventName', 'seats', 'qrCode']),
      isActive: true,
    },
  });

  console.log('✅ Email templates created');

  // Create events from mockup data
  console.log('Creating events from mockup data...');
  
  const event1 = await prisma.event.upsert({
    where: { slug: 'tedx-fpt-hcmc-2026' },
    update: {},
    create: {
      name: 'TEDxFPTUniversityHCMC 2026: Finding Flow',
      slug: 'tedx-fpt-hcmc-2026',
      description: 'TEDxFPTUniversityHCMC 2026 explores the state of flow',
      venue: 'FPT University HCMC, D1 Street, Long Thanh My, Thu Duc, HCMC',
      eventDate: new Date('2026-03-15T09:00:00'),
      eventEndDate: new Date('2026-03-15T17:00:00'),
      registrationStartDate: new Date('2026-01-01'),
      registrationEndDate: new Date('2026-03-10'),
      status: 'PUBLISHED',
      maxAttendees: 500,
      bannerUrl: '/events/tedx-2026-banner.jpg',
      thumbnailUrl: '/events/tedx-2026-thumb.jpg',
    },
  });

  console.log('✅ Event created:', event1.name);

  // Create seat layout
  const layout = await prisma.seatLayout.upsert({
    where: { id: 'layout-1' },
    update: {},
    create: {
      id: 'layout-1',
      eventId: event1.id,
      name: 'Main Hall',
      rows: 8,
      seatsPerRow: 12,
    },
  });

  // Create seats
  console.log('Creating seats...');
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const seatsPerRow = 12;

  for (const row of rows) {
    for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
      const seatLabel = `${row}${seatNum}`;
      const isVIP = ['A', 'B'].includes(row);
      
      await prisma.seat.upsert({
        where: { 
          eventId_seatLabel: { eventId: event1.id, seatLabel } 
        },
        update: {},
        create: {
          eventId: event1.id,
          layoutId: layout.id,
          seatLabel,
          row,
          seatNumber: seatNum,
          category: isVIP ? 'VIP' : 'Standard',
          price: isVIP ? 2500000 : 1500000,
          status: 'AVAILABLE',
        },
      });
    }
  }

  console.log('✅ 96 seats created');
  console.log('🎉 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

