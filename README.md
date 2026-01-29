# TEDxFPTUniversityHCMC 2026 - Ticketing Platform

> **Theme:** Finding Flow

A production-ready, serverless ticketing platform built with Next.js, designed to handle massive concurrent ticket purchases with zero overselling.

## 🏗️ Architecture

- **Frontend (Client):** Next.js 16 - Public event website
- **Frontend (Admin):** Next.js 16 - Admin dashboard with API routes
- **Database:** MySQL with Prisma ORM
- **Cache/Lock:** Redis (Upstash) for seat locking
- **Email:** Resend / SendGrid / Mock
- **Payment:** Stripe / VNPay / MoMo / ZaloPay / Mock

## ✨ Key Features

### Anti-Overselling System
- **Redis-based seat locking** with TTL (no database locks)
- **Atomic lock acquisition** using `SET NX EX`
- **Automatic lock expiration** after 5 minutes
- **Idempotent payment webhooks** to prevent double-booking

### Serverless-Safe Design
- **Stateless API routes** - no in-memory state
- **Webhook-driven payments** - single source of truth
- **Retry-safe email sending** - logged and tracked
- **Rate limiting** with Redis

### Admin Features
- Event management (CRUD)
- Visual seat layout builder
- Order management
- Email template designer
- Audit logging
- Role-based access control (RBAC)

## 📁 Project Structure

```
project-detedxs26/
├── web-client/          # Public event website (Next.js)
└── web-admin/           # Admin dashboard + API (Next.js)
    ├── src/
    │   ├── app/
    │   │   ├── admin/   # Admin UI pages
    │   │   └── api/     # API Routes
    │   │       ├── auth/
    │   │       ├── events/
    │   │       ├── seats/
    │   │       ├── orders/
    │   │       ├── payments/
    │   │       └── email/
    │   └── lib/
    │       ├── prisma.ts      # Database client
    │       ├── redis.ts       # Redis client + seat locking
    │       ├── auth.ts        # JWT authentication
    │       ├── mail.ts        # Email service
    │       ├── qrcode.ts      # QR code generation
    │       └── utils.ts       # Utilities
    ├── prisma/
    │   └── schema.prisma      # Database schema
    ├── scripts/
    │   └── seed.ts            # Database seeding
    └── .env.example           # Environment variables template
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Redis (optional, uses mock in development)

### 1. Clone & Install

```bash
cd web-admin
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL="mysql://root:password@localhost:3306/tedx_ticketing"

# JWT
JWT_SECRET="your-super-secret-jwt-key-min-32-characters-long"

# Redis (optional for development)
REDIS_URL="redis://localhost:6379"

# Email (use mock for development)
EMAIL_PROVIDER="mock"

# Payment (use mock for development)
PAYMENT_PROVIDER="mock"

# Node Environment
NODE_ENV="development"
```

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npx prisma migrate dev --name init

# Seed database (creates admin user + roles)
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Admin dashboard: http://localhost:3002

### 5. Login

```
Email: admin@tedxfptuhcm.com
Password: admin123456
```

## 📊 Database Schema

### Core Tables

- **users** - User accounts
- **roles** - RBAC roles (SUPER_ADMIN, ADMIN, STAFF, USER)
- **events** - Event information
- **seats** - Individual seats with pricing
- **seat_layouts** - Seat map configurations (JSON)
- **orders** - Ticket orders
- **order_items** - Order line items
- **payments** - Payment transactions
- **email_templates** - HTML email templates
- **email_logs** - Email sending history
- **audit_logs** - Admin action tracking

## 🔐 Authentication

### JWT-based Authentication

```typescript
// Login
POST /api/auth/login
{
  "email": "admin@tedxfptuhcm.com",
  "password": "admin123456"
}

// Response
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

// Use token in subsequent requests
Authorization: Bearer <token>
```

## 🎫 Seat Locking Flow

### 1. User selects seats
```typescript
POST /api/seats/lock
{
  "eventId": "uuid",
  "seatIds": ["seat-uuid-1", "seat-uuid-2"]
}
```

### 2. System locks seats in Redis
```
SET seat:{eventId}:{seatId} {userId} NX EX 300
```

### 3. User completes payment within 5 minutes

### 4. Webhook confirms payment → seats marked as SOLD

### 5. Lock expires → seats auto-released if unpaid

## 💳 Payment Flow

### 1. Create Payment Session

```typescript
POST /api/payments/create
{
  "orderId": "uuid",
  "paymentMethod": "stripe"
}

// Response
{
  "success": true,
  "data": {
    "sessionUrl": "https://checkout.stripe.com/..."
  }
}
```

### 2. User redirected to payment gateway

### 3. Webhook receives payment confirmation

```typescript
POST /api/payments/webhook
// Stripe/VNPay/MoMo sends webhook

// System:
// 1. Verifies signature
// 2. Checks idempotency (prevent double-processing)
// 3. Marks order as PAID
// 4. Updates seats to SOLD
// 5. Sends ticket email
```

## 📧 Email System

### Send Ticket Email

```typescript
import { sendTicketEmail } from '@/lib/mail';

await sendTicketEmail({
  to: 'customer@example.com',
  customerName: 'John Doe',
  eventName: 'TEDx 2026',
  eventDate: '2026-05-15',
  eventVenue: 'FPT University',
  orderNumber: 'ORD-123',
  seats: [
    { seatNumber: 'A1', seatType: 'VIP', price: 50 }
  ],
  totalAmount: 50,
  qrCodeUrl: 'data:image/png;base64,...'
});
```

## 🛡️ Security Features

- **JWT authentication** with secure secret
- **Password hashing** with bcrypt
- **Rate limiting** on login endpoints
- **Input validation** with Zod
- **SQL injection protection** via Prisma
- **CSRF protection** (Next.js built-in)
- **Audit logging** for admin actions

## 🧪 Mock Mode

For development without external services:

```env
NODE_ENV="mock"
EMAIL_PROVIDER="mock"
PAYMENT_PROVIDER="mock"
```

- No Redis required (uses in-memory mock)
- No email service required (logs to console)
- No payment gateway required (instant confirmation)

## 📦 Deployment

### Environment Variables (Production)

```env
DATABASE_URL="mysql://user:pass@prod-host:3306/tedx_ticketing"
REDIS_URL="https://your-upstash-redis.upstash.io"
REDIS_TOKEN="your-upstash-token"
JWT_SECRET="production-secret-min-32-chars"
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_..."
PAYMENT_PROVIDER="stripe"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NODE_ENV="production"
```

### Build & Deploy

```bash
npm run build
npm start
```

### Vercel Deployment

```bash
vercel --prod
```

## 🔧 Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
npm run db:seed          # Seed database
```

## 📝 API Documentation

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/me` - Get current user

### Events (Admin only)
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Seats
- `POST /api/seats/lock` - Lock seats
- `POST /api/seats/unlock` - Unlock seats
- `GET /api/seats/:eventId` - Get event seats

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details

### Payments
- `POST /api/payments/create` - Create payment session
- `POST /api/payments/webhook` - Payment webhook
- `GET /api/payments/status/:orderId` - Check payment status

### Email
- `POST /api/email/send` - Send email
- `GET /api/email/templates` - List templates
- `POST /api/email/templates` - Create template

## 🤝 Contributing

This is a private project for TEDxFPTUniversityHCMC 2026.

## 📄 License

Proprietary - All rights reserved.

---

Built with ❤️ by TEDxFPTUniversityHCMC Tech Team

