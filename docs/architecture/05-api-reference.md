# API Reference

> **🎯 For:** Frontend & API developers  
> **📅 Last Updated:** 2026-06-13  
> **🔗 Previous:** [Business Flows](./04-business-flows.md) | **Next:** [Frontend Architecture](./06-frontend-architecture.md)

---

## 🌐 API Overview

**Base URL:** `http://localhost:4000/api` (development)  
**Production:** `https://api.tedxfptuhcm.com/api`  
**Format:** JSON  
**Authentication:** JWT Bearer token (admin routes only)

---

## 🔐 Authentication

### POST `/api/auth/login`
Admin login

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "fullName": "Admin User",
      "role": "ADMIN"
    }
  }
}
```

**Headers for subsequent requests:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 🎫 Public Event APIs

### GET `/api/events`
List all published events

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "TEDxFPTUniversityHCMC 2026",
      "slug": "tedxfptuhcmc-2026",
      "eventDate": "2026-08-15T09:00:00Z",
      "venue": "FPT University HCM",
      "availableSeats": 450,
      "maxCapacity": 500,
      "bannerImageUrl": "https://...",
      "status": "PUBLISHED"
    }
  ]
}
```

### GET `/api/events/:slug`
Get event details with seat map

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "TEDxFPTUniversityHCMC 2026",
    "seats": [
      {
        "id": "uuid",
        "seatNumber": "A1",
        "row": "A",
        "col": "1",
        "section": "CENTER",
        "seatType": "VIP",
        "price": 500000,
        "status": "AVAILABLE"  // AVAILABLE | PENDING | SOLD | DISABLED
      }
    ]
  }
}
```

---

## 🪑 Seat Locking

### POST `/api/seats/lock`
Lock seats before checkout (5-minute TTL)

**Request:**
```json
{
  "eventId": "uuid",
  "seatIds": ["seat-uuid-1", "seat-uuid-2"],
  "sessionId": "browser-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lockedSeats": ["seat-uuid-1", "seat-uuid-2"],
    "expiresAt": "2026-06-13T10:05:00Z"
  }
}
```

**Errors:**
```json
{
  "success": false,
  "error": "Seat A1 is already locked by another user"
}
```

### POST `/api/seats/unlock`
Release locked seats

**Request:**
```json
{
  "eventId": "uuid",
  "seatIds": ["seat-uuid-1"]
}
```

---

## 🛒 Order Management

### POST `/api/orders/create-pending`
Create order (after seats locked)

**Request:**
```json
{
  "eventId": "uuid",
  "seatIds": ["seat-uuid-1", "seat-uuid-2"],
  "customerEmail": "user@example.com",
  "customerName": "Nguyễn Văn A",
  "customerPhone": "0901234567"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "orderNumber": "TKH12AB3C",
    "totalAmount": 1000000,
    "expiresAt": "2026-06-13T10:30:00Z",
    "paymentUrl": "https://payment-gateway.com/checkout/..."
  }
}
```

---

## 💳 Payment Webhook

### POST `/api/webhooks/payment`
Payment gateway callback (VNPay/Momo)

**Request (from gateway):**
```json
{
  "transactionId": "VNP123456",
  "amount": 1000000,
  "status": "SUCCESS",
  "orderNumber": "TKH12AB3C",
  "signature": "sha256-signature"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed"
}
```

**Side effects:**
- Updates `payment.status = COMPLETED`
- Updates `order.status = PENDING_CONFIRMATION`
- Generates `access_token`
- Sends ticket email

---

## 🎟️ Ticket View (Public)

### GET `/api/tickets/view`
View ticket with access token

**Query Params:**
- `order`: Order number (e.g., `TKH12AB3C`)
- `token`: Access token (64-char hex)

**Response:**
```json
{
  "success": true,
  "data": {
    "orderNumber": "TKH12AB3C",
    "customerName": "Nguyễn Văn A",
    "status": "PAID",
    "qrCodeUrl": "https://cdn.cloudinary.com/...",
    "seats": [
      {
        "seatNumber": "A1",
        "seatType": "VIP",
        "price": 500000
      }
    ],
    "event": {
      "name": "TEDxFPTUniversityHCMC 2026",
      "eventDate": "2026-08-15T09:00:00Z",
      "venue": "FPT University HCM"
    }
  }
}
```

---

## 🔒 Admin APIs (Requires Auth)

All admin routes require `Authorization: Bearer <token>` header.

### GET `/api/admin/orders`
List orders (with filtering)

**Query Params:**
- `status`: Filter by status (PENDING, PENDING_CONFIRMATION, PAID, etc.)
- `eventId`: Filter by event
- `page`: Pagination (default: 1)
- `limit`: Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid",
        "orderNumber": "TKH12AB3C",
        "customerName": "Nguyễn Văn A",
        "customerEmail": "user@example.com",
        "status": "PENDING_CONFIRMATION",
        "totalAmount": 1000000,
        "paidAt": "2026-06-13T10:15:00Z",
        "createdAt": "2026-06-13T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    }
  }
}
```

### POST `/api/admin/orders/:id/confirm-payment`
Confirm payment manually

**Response:**
```json
{
  "success": true,
  "message": "Payment confirmed. Email sent to customer.",
  "data": {
    "orderId": "uuid",
    "status": "PAID",
    "hasExistingToken": true
  }
}
```

### POST `/api/admin/orders/:id/cancel`
Cancel order

**Request:**
```json
{
  "reason": "Customer requested cancellation"
}
```

---

## ✅ Check-In API

### POST `/api/tickets/check-in`
Check in ticket at event (Staff only)

**Request:**
```json
{
  "orderNumber": "TKH12AB3C",
  "token": "access-token-from-qr"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customerName": "Nguyễn Văn A",
    "seats": 2,
    "checkedInAt": "2026-08-15T09:30:00Z"
  }
}
```

**Errors:**
- `401`: Invalid QR code
- `400`: Already checked in
- `400`: Ticket not confirmed

---

**Next:** [Frontend Architecture →](./06-frontend-architecture.md)
