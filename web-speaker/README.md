# TEDxFPTUniversityHCMC 2026 - Admin Dashboard

> **Theme:** Finding Flow
> **Payment Method:** Manual Bank Transfer with Admin Confirmation

## 🎯 Overview

Admin dashboard and API system for TEDxFPTUniversityHCMC 2026 event ticketing platform. Built with Next.js App Router, designed for manual bank transfer payment flow with admin verification.

## 💳 LUỒNG NGHIỆP VỤ - MANUAL BANK TRANSFER

### 1️⃣ User Đặt Vé

- User chọn sự kiện và ghế ngồi
- Nhập thông tin: Tên, Email, SĐT
- Hệ thống tạo **ORDER** với status `PENDING`
- Ghế được đánh dấu `RESERVED`
- Hiển thị thông tin chuyển khoản:
  - **Ngân hàng**: Vietcombank
  - **Số TK**: 1234567890
  - **Tên TK**: TEDxFPTUniversityHCMC
  - **Nội dung CK**: **ORDER_CODE** (VD: ORD-2026-ABC123)

### 2️⃣ User Chuyển Khoản

- User mở app ngân hàng
- Chuyển khoản đúng số tiền
- Ghi đúng nội dung: ORDER_CODE
- Chờ admin xác nhận (< 30 phút)

### 3️⃣ Admin Xác Nhận Thanh Toán

1. Admin đăng nhập: `/admin/login`
2. Vào trang **Quản lý Đơn hàng**: `/admin/orders`
3. Lọc đơn hàng `PENDING`
4. Đối soát thủ công qua app ngân hàng
5. Click nút **"Xác nhận TT"**

### 4️⃣ Hệ Thống Xử Lý (Tự Động)

- ✅ Order: `PENDING` → `PAID`
- ✅ Payment: `PENDING` → `COMPLETED`
- ✅ Seats: `RESERVED` → `SOLD`
- ✅ Generate QR Code
- ✅ Gửi email vé cho khách
- ✅ Ghi audit log

### 5️⃣ Email Vé Gửi Đến Khách

- Thông tin sự kiện
- Thông tin ghế ngồi
- Mã đơn hàng
- **QR Code** để check-in

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="mysql://root:password@localhost:3306/tedx_ticketing"
JWT_SECRET="your-super-secret-jwt-key-min-32-characters"
REDIS_URL="redis://localhost:6379"  # Optional
EMAIL_PROVIDER="mock"
PAYMENT_PROVIDER="mock"
NODE_ENV="development"
```

### 3. Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (includes mockup data from web-client)
npm run db:seed
```

### 4. Start Server

```bash
npm run dev
```

Admin: http://localhost:3002/admin/login

## 🔐 Default Login

```
Email: admin@tedxfptuhcm.com
Password: admin123456
```

## 📊 Seed Data

The seed script creates:

1. **Roles**: SUPER_ADMIN, ADMIN, STAFF, USER
2. **Admin User**: admin@tedxfptuhcm.com
3. **Email Templates**: ticket_confirmation
4. **Events** (from web-client mockup):
   - TEDxFPTUniversityHCMC 2026: Finding Flow (March 15, 2026)
   - TEDxYouth@Saigon (April 20, 2026)
5. **Seats**: 96 seats per event (8 rows × 12 seats)
   - Rows A-B: VIP (2,500,000 VND)
   - Rows C-H: Standard (1,500,000 VND)
   - 11 seats pre-sold for Event 1

## 📚 API Endpoints

### Public APIs

**Create Order**

```http
POST /api/orders
{
  "eventId": "uuid",
  "seatIds": ["uuid1", "uuid2"],
  "customerName": "Nguyen Van A",
  "customerEmail": "email@example.com",
  "customerPhone": "0901234567"
}
```

### Admin APIs (Requires JWT)

**List Orders**

```http
GET /api/admin/orders?status=PENDING
Authorization: Bearer <token>
```

**Confirm Payment** (CRITICAL)

```http
POST /api/admin/orders/:id/confirm
Authorization: Bearer <token>
{
  "transactionId": "MANUAL-1234567890",
  "notes": "Đã xác nhận chuyển khoản"
}
```

## 🏗️ Project Structure

```
web-admin/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── login/         # Admin login
│   │   │   ├── dashboard/     # Dashboard
│   │   │   └── orders/        # Orders management (CRITICAL)
│   │   └── api/
│   │       ├── auth/          # Authentication
│   │       ├── orders/        # Create order
│   │       ├── events/        # Event management
│   │       └── admin/orders/  # Admin order APIs
│   └── lib/
│       ├── prisma.ts          # Database client
│       ├── redis.ts           # Redis (with mock)
│       ├── auth.ts            # JWT
│       ├── mail.ts            # Email
│       └── qrcode.ts          # QR code
├── prisma/
│   └── schema.prisma
└── scripts/
    └── seed.ts
```

## 🔧 Scripts

```bash
npm run dev              # Development server (port 3002)
npm run build            # Build for production
npm start                # Start production server
npm run db:seed          # Seed database
npx prisma studio        # Open Prisma Studio
```

## 📝 License

MIT
