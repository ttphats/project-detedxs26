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

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator with management access',
      permissions: JSON.stringify(['events.*', 'seats.*', 'orders.*', 'emails.*']),
    },
  });

  const staffRole = await prisma.role.upsert({
    where: { name: 'STAFF' },
    update: {},
    create: {
      name: 'STAFF',
      description: 'Staff with limited access',
      permissions: JSON.stringify(['orders.read', 'events.read']),
    },
  });

  const userRole = await prisma.role.upsert({
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

  const superAdmin = await prisma.user.upsert({
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

  // Create sample email templates
  console.log('Creating email templates...');

  await prisma.emailTemplate.upsert({
    where: { name: 'ticket_confirmation' },
    update: {},
    create: {
      name: 'ticket_confirmation',
      subject: 'Your TEDx Ticket - {{eventName}}',
      htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your TEDx Ticket</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #e62b1e; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0;">TEDx Ticket Confirmation</h1>
  </div>
  
  <div style="padding: 20px; background: #f9f9f9;">
    <h2>Hello {{customerName}},</h2>
    <p>Thank you for your purchase! Your tickets for <strong>{{eventName}}</strong> are confirmed.</p>
    
    <div style="background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #e62b1e;">
      <h3 style="margin-top: 0;">Event Details</h3>
      <p><strong>Event:</strong> {{eventName}}</p>
      <p><strong>Date:</strong> {{eventDate}}</p>
      <p><strong>Venue:</strong> {{eventVenue}}</p>
      <p><strong>Order Number:</strong> {{orderNumber}}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <img src="{{qrCodeUrl}}" alt="QR Code" style="max-width: 200px;" />
      <p style="font-size: 12px; color: #666;">Present this QR code at the event entrance</p>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      If you have any questions, please contact us at support@tedxfptuhcm.com
    </p>
  </div>

  <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
    <p>© 2026 TEDxFPTUniversityHCMC. All rights reserved.</p>
  </div>
</body>
</html>
      `,
      textContent: 'Your TEDx ticket confirmation',
      variables: JSON.stringify(['customerName', 'eventName', 'eventDate', 'eventVenue', 'orderNumber', 'qrCodeUrl']),
      isActive: true,
    },
  });

  console.log('✅ Email templates created');

  // Create events from web-client mockup data
  console.log('Creating events from mockup data...');

  const event1 = await prisma.event.upsert({
    where: { slug: 'tedxfptuniversityhcmc-2026-finding-flow' },
    update: {},
    create: {
      name: 'TEDxFPTUniversityHCMC 2026: Finding Flow',
      slug: 'tedxfptuniversityhcmc-2026-finding-flow',
      description: 'TEDxFPTUniversityHCMC 2026: Finding Flow brings together visionaries, innovators, and change-makers to share groundbreaking ideas about achieving flow states in work, creativity, and life. Join us for an unforgettable day of powerful talks, creative performances, and meaningful connections that will transform the way you see the world.',
      venue: 'FPT University HCMC Campus',
      eventDate: new Date('2026-03-15T08:30:00Z'),
      doorsOpenTime: new Date('2026-03-15T08:00:00Z'),
      startTime: new Date('2026-03-15T08:30:00Z'),
      endTime: new Date('2026-03-15T18:00:00Z'),
      maxCapacity: 96, // 8 rows x 12 seats
      availableSeats: 85, // 96 - 11 sold seats
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date(),
      bannerImageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1920&h=1080&fit=crop',
      thumbnailUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=400&fit=crop',
      metadata: JSON.stringify({
        tagline: 'Finding Flow',
        location: 'Ho Chi Minh City, Vietnam',
        highlights: [
          { icon: 'mic', text: '12 Inspiring Speakers' },
          { icon: 'lightbulb', text: 'Ideas Worth Spreading' },
          { icon: 'users', text: '500+ Attendees' },
          { icon: 'coffee', text: 'Networking Sessions' },
        ],
        speakers: [
          {
            id: 's1',
            name: 'Dr. Nguyen Thi Mai',
            title: 'AI Research Director tại VinAI Research với hơn 15 năm kinh nghiệm trong lĩnh vực Machine Learning và Computer Vision.',
            company: 'VinAI Research',
            bio: 'Leading AI researcher with 15+ years of experience in machine learning and computer vision.',
            image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop',
            topic: 'The Future of AI in Southeast Asia',
          },
          {
            id: 's2',
            name: 'Tran Minh Duc',
            title: 'Founder & CEO của EcoVietnam - startup tiên phong trong lĩnh vực nông nghiệp bền vững.',
            company: 'EcoVietnam',
            bio: 'Social entrepreneur revolutionizing sustainable agriculture in the Mekong Delta.',
            image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
            topic: 'Reimagining Agriculture for Climate Resilience',
          },
          {
            id: 's3',
            name: 'Le Hoang Anh',
            title: 'Tác giả đoạt giải thưởng văn học với 5 cuốn sách bestseller về bản sắc Việt Nam.',
            company: 'Independent',
            bio: 'Bestselling author exploring Vietnamese identity and diaspora experiences.',
            image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
            topic: 'Stories That Connect Us',
          },
          {
            id: 's4',
            name: 'Prof. Pham Van Tuan',
            title: 'Giáo sư Vật lý Lượng tử tại Đại học Quốc gia Việt Nam, chuyên gia hàng đầu về điện toán lượng tử.',
            company: 'Vietnam National University',
            bio: 'Pioneering researcher in quantum computing and its applications.',
            image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
            topic: 'Quantum Leap: Computing Beyond Limits',
          },
        ],
        timeline: [
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
        ],
      }),
    },
  });

  const event2 = await prisma.event.upsert({
    where: { slug: 'tedxyouth-saigon' },
    update: {},
    create: {
      name: 'TEDxYouth@Saigon',
      slug: 'tedxyouth-saigon',
      description: 'Empowering the next generation of thinkers and leaders. TEDxYouth@Saigon celebrates young voices with fresh perspectives on technology, creativity, and social change.',
      venue: 'RMIT University Vietnam',
      eventDate: new Date('2026-04-20T09:00:00Z'),
      doorsOpenTime: new Date('2026-04-20T08:30:00Z'),
      startTime: new Date('2026-04-20T09:00:00Z'),
      endTime: new Date('2026-04-20T16:00:00Z'),
      maxCapacity: 96,
      availableSeats: 96,
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date(),
      metadata: JSON.stringify({
        tagline: 'Young Voices, Bold Ideas',
        location: 'Ho Chi Minh City, Vietnam',
        highlights: [
          { icon: 'sparkles', text: 'Young Innovators' },
          { icon: 'presentation', text: '8 Youth Speakers' },
          { icon: 'music', text: 'Live Performances' },
          { icon: 'heart', text: 'Community Impact' },
        ],
      }),
    },
  });

  console.log('✅ Events created');

  // Create seat layouts and seats for Event 1
  console.log('Creating seat layouts and seats...');

  const seatLayout1 = await prisma.seatLayout.create({
    data: {
      eventId: event1.id,
      name: 'Main Hall',
      totalRows: 8,
      totalSeatsPerRow: 12,
      metadata: JSON.stringify({
        sections: ['VIP', 'Standard'],
        vipRows: ['A', 'B'],
      }),
    },
  });

  // Create seats for Event 1 (8 rows x 12 seats = 96 seats)
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const seatsPerRow = 12;
  const soldSeats = ['A3', 'A4', 'B5', 'B6', 'C7', 'D2', 'E8', 'F1', 'G10', 'H5', 'H6'];

  const seatsToCreate = [];
  for (const row of rows) {
    const isVIPRow = ['A', 'B'].includes(row);
    for (let i = 1; i <= seatsPerRow; i++) {
      const seatNumber = `${row}${i}`;
      const isSold = soldSeats.includes(seatNumber);

      seatsToCreate.push({
        eventId: event1.id,
        seatLayoutId: seatLayout1.id,
        seatNumber,
        row,
        seatType: isVIPRow ? 'VIP' : 'STANDARD',
        section: isVIPRow ? 'VIP' : 'Standard',
        price: isVIPRow ? 2500000 : 1500000, // VND
        status: isSold ? 'SOLD' : 'AVAILABLE',
        isDisabled: false,
      });
    }
  }

  await prisma.seat.createMany({
    data: seatsToCreate,
  });

  console.log(`✅ Created ${seatsToCreate.length} seats for Event 1`);

  console.log('');
  console.log('🎉 Database seed completed successfully!');
  console.log('');
  console.log('📝 Login credentials:');
  console.log('   Email: admin@tedxfptuhcm.com');
  console.log('   Password: admin123456');
  console.log('');
  console.log('📅 Events created:');
  console.log(`   1. ${event1.name} (${event1.availableSeats}/${event1.maxCapacity} seats available)`);
  console.log(`   2. ${event2.name} (${event2.availableSeats}/${event2.maxCapacity} seats available)`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

