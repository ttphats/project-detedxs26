# Payment Flow + Email Confirmation - TEDxFPTUniversityHCMC

## 1. Tổng Quan Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PAYMENT FLOW DIAGRAM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Client] ──► Chọn ghế ──► Đặt vé ──► Payment PENDING                   │
│                                              │                           │
│                                              ▼                           │
│                                   [User chuyển khoản]                   │
│                                              │                           │
│                                              ▼                           │
│                                        [Admin]                          │
│                                        /      \                         │
│                                       /        \                        │
│                                      ▼          ▼                       │
│                               [CONFIRM]      [REJECT]                   │
│                                    │              │                     │
│                                    ▼              ▼                     │
│                          ┌─────────────┐  ┌──────────────┐             │
│                          │ Order: PAID │  │Order:CANCELLED│            │
│                          │ Payment:    │  │Payment: FAILED│            │
│                          │ COMPLETED   │  │Seats: AVAILABLE│           │
│                          │ Seats: SOLD │  │ NO EMAIL SENT │            │
│                          └──────┬──────┘  └──────────────┘             │
│                                 │                                       │
│                                 ▼                                       │
│                          ✉️ GỬI EMAIL                                   │
│                          + QR CODE                                      │
│                          + Log email_sent_at                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Status Flow

### Order Status
```
PENDING ──► PAID (khi admin confirm)
        ──► CANCELLED (khi admin reject hoặc hết hạn)
        ──► EXPIRED (khi quá thời gian thanh toán)
```

### Payment Status  
```
PENDING ──► COMPLETED (khi admin confirm)
        ──► FAILED (khi admin reject)
        ──► REFUNDED (khi hoàn tiền)
```

### Seat Status
```
AVAILABLE ──► LOCKED (khi đang giữ chỗ)
          ──► SOLD (khi thanh toán thành công)
          
LOCKED ──► AVAILABLE (khi reject hoặc hết hạn)
       ──► SOLD (khi confirm)
```

## 3. API Endpoints

### 3.1 Xác Nhận Thanh Toán (CONFIRM)
```http
POST /api/admin/orders/:id/confirm
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "transactionId": "VCB-123456789",  // Optional
  "notes": "Đã xác nhận chuyển khoản"  // Optional
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "orderNumber": "TEDx-2026-001",
    "status": "PAID",
    "paidAt": "2026-01-30T10:00:00Z"
  },
  "message": "Payment confirmed successfully. Ticket email sent to customer."
}
```

### 3.2 Từ Chối Thanh Toán (REJECT)
```http
POST /api/admin/orders/:id/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "Không tìm thấy giao dịch chuyển khoản",  // Required
  "notes": "Đã liên hệ khách hàng"  // Optional
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "orderNumber": "TEDx-2026-001",
    "status": "CANCELLED",
    "cancelledAt": "2026-01-30T10:00:00Z",
    "releasedSeats": 2
  },
  "message": "Payment rejected. Seats have been released."
}
```

### 3.3 Gửi Lại Email (RESEND)
```http
POST /api/admin/orders/:id/resend-email
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "orderNumber": "TEDx-2026-001",
    "emailSentTo": "customer@email.com",
    "emailId": "resend-abc123"
  },
  "message": "Ticket confirmation email resent successfully."
}
```

## 4. SQL Schema

### Orders Table (Updated)
```sql
CREATE TABLE orders (
  id VARCHAR(36) PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(36),
  event_id VARCHAR(36) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PAID, FAILED, EXPIRED, CANCELLED
  customer_email VARCHAR(100) NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20),
  expires_at DATETIME,
  paid_at DATETIME,
  cancelled_at DATETIME,
  cancellation_reason TEXT,
  email_sent_at DATETIME,  -- NEW: Track when email was sent
  qr_code_url VARCHAR(500),  -- NEW: Store QR code URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status (status),
  INDEX idx_order_number (order_number),
  INDEX idx_customer_email (customer_email),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### Payments Table
```sql
CREATE TABLE payments (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) UNIQUE NOT NULL,
  payment_method VARCHAR(30) NOT NULL,  -- BANK_TRANSFER, CREDIT_CARD, VNPAY, MOMO
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, COMPLETED, FAILED, REFUNDED
  transaction_id VARCHAR(100) UNIQUE,
  payment_gateway VARCHAR(50),
  payment_session_id VARCHAR(100) UNIQUE,
  payment_proof VARCHAR(500),  -- URL to uploaded proof
  webhook_received BOOLEAN DEFAULT FALSE,
  webhook_processed BOOLEAN DEFAULT FALSE,
  webhook_data TEXT,
  paid_at DATETIME,
  refunded_at DATETIME,
  refund_reason TEXT,
  metadata TEXT,  -- JSON: confirmedBy, rejectedBy, notes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status (status),
  INDEX idx_transaction_id (transaction_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

