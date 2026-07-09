# Database Schema

> **🎯 For:** All developers  
> **📅 Last Updated:** 2026-06-13  
> **🔗 Previous:** [Backend Architecture](./02-backend-architecture.md) | **Next:** [Business Flows](./04-business-flows.md)

---

## 📐 Database Overview

**Database:** MySQL 8.0  
**ORM:** Prisma 5.x  
**Connection:** mysql2 connection pool  
**Schema Management:** Prisma Migrate

---

## 🗺️ Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ ORDERS : "places"
    USERS ||--o{ AUDIT_LOGS : "performs"
    ROLES ||--o{ USERS : "has"

    EVENTS ||--o{ SEATS : "contains"
    EVENTS ||--o{ SEAT_LAYOUTS : "has"
    EVENTS ||--o{ ORDERS : "for"
    EVENTS ||--o{ EVENT_TIMELINES : "timeline"

    SEATS ||--o{ ORDER_ITEMS : "sold_as"
    SEATS ||--o| SEAT_LOCKS : "locked_by"

    ORDERS ||--|{ ORDER_ITEMS : "contains"
    ORDERS ||--o| PAYMENTS : "paid_by"
    ORDERS ||--o{ EMAIL_LOGS : "generates"

    EMAIL_TEMPLATES ||--o{ EMAIL_LOGS : "used_in"

    USERS {
        uuid id PK
        string username UK
        string email UK
        string passwordHash
        uuid roleId FK
        boolean isActive
        datetime lastLoginAt
    }

    ROLES {
        uuid id PK
        string name UK
        string permissions
    }

    EVENTS {
        uuid id PK
        string name
        string slug UK
        datetime eventDate
        string status
        int maxCapacity
        int availableSeats
    }

    SEATS {
        uuid id PK
        uuid eventId FK
        string seatNumber
        string seatType
        decimal price
        string status
    }

    ORDERS {
        uuid id PK
        string orderNumber UK
        uuid eventId FK
        string status
        decimal totalAmount
        string customerEmail
        string accessToken
        string accessTokenHash
    }

    ORDER_ITEMS {
        uuid id PK
        uuid orderId FK
        uuid seatId FK
        decimal price
        string seatNumber
    }

    PAYMENTS {
        uuid id PK
        uuid orderId FK UK
        string paymentMethod
        decimal amount
        string status
        string transactionId UK
    }
```

---

## 📊 Core Tables

### 🔐 Authentication Tables

#### `users`

**Purpose:** User accounts for admin & staff

| Column          | Type         | Constraints      | Description            |
| --------------- | ------------ | ---------------- | ---------------------- |
| `id`            | UUID         | PK               | Primary key            |
| `username`      | VARCHAR(50)  | UNIQUE, NOT NULL | Login username         |
| `email`         | VARCHAR(100) | UNIQUE, NULLABLE | Email address          |
| `password_hash` | VARCHAR(255) | NULLABLE         | Bcrypt hashed password |
| `full_name`     | VARCHAR(100) | NOT NULL         | Display name           |
| `phone_number`  | VARCHAR(20)  | NULLABLE         | Contact number         |
| `role_id`       | UUID         | FK → roles.id    | User role              |
| `is_active`     | BOOLEAN      | DEFAULT TRUE     | Account status         |
| `last_login_at` | DATETIME     | NULLABLE         | Last login timestamp   |

**Indexes:**

- `email` - Unique login lookup
- `role_id` - Role filtering

**Business Rules:**

- Username must be unique
- Password hashed with bcryptjs (10 rounds)
- Soft-delete via `is_active` flag

#### `roles`

**Purpose:** RBAC roles

| Column        | Type         | Description                     |
| ------------- | ------------ | ------------------------------- |
| `id`          | UUID         | Primary key                     |
| `name`        | VARCHAR(50)  | SUPER_ADMIN, ADMIN, STAFF, USER |
| `description` | VARCHAR(255) | Role description                |
| `permissions` | TEXT         | JSON permissions (future)       |

**Predefined Roles:**

- `SUPER_ADMIN` - Full system access
- `ADMIN` - Event & order management
- `STAFF` - Check-in only
- `USER` - Regular customer (future)

---

### 🎫 Event Management Tables

#### `events`

**Purpose:** TEDx events

| Column             | Type         | Description                            |
| ------------------ | ------------ | -------------------------------------- |
| `id`               | UUID         | Primary key                            |
| `name`             | VARCHAR(200) | Event name                             |
| `slug`             | VARCHAR(100) | URL-friendly slug (UNIQUE)             |
| `description`      | TEXT         | Event description                      |
| `venue`            | VARCHAR(200) | Location                               |
| `event_date`       | DATETIME     | Event start date                       |
| `doors_open_time`  | DATETIME     | When doors open                        |
| `start_time`       | DATETIME     | Event start time                       |
| `status`           | VARCHAR(20)  | DRAFT, PUBLISHED, CANCELLED, COMPLETED |
| `max_capacity`     | INT          | Total seats                            |
| `available_seats`  | INT          | Remaining seats                        |
| `banner_image_url` | VARCHAR(500) | Cloudinary URL                         |
| `is_published`     | BOOLEAN      | Visibility flag                        |

**Indexes:**

- `slug` - URL lookup
- `status` - Filter by status
- `event_date` - Date filtering

#### `seats`

**Purpose:** Individual seats for events

| Column        | Type          | Description                        |
| ------------- | ------------- | ---------------------------------- |
| `id`          | UUID          | Primary key                        |
| `event_id`    | UUID          | FK → events.id                     |
| `seat_number` | VARCHAR(20)   | Display number (e.g., "A1")        |
| `row`         | VARCHAR(10)   | Row identifier                     |
| `col`         | VARCHAR(10)   | Column identifier                  |
| `section`     | VARCHAR(50)   | Section (LEFT, CENTER, RIGHT)      |
| `seat_type`   | VARCHAR(20)   | VIP, STANDARD, ECONOMY             |
| `price`       | DECIMAL(10,2) | Ticket price                       |
| `status`      | VARCHAR(20)   | AVAILABLE, PENDING, SOLD, DISABLED |
| `position_x`  | INT           | Visual X coordinate                |
| `position_y`  | INT           | Visual Y coordinate                |

**Indexes:**

- `(event_id, seat_number)` - UNIQUE constraint
- `(event_id, status)` - Fast availability check
- `seat_type` - Filter by type

**Seat Status Flow:**

```
AVAILABLE → PENDING (locked) → SOLD (paid)
          ↓
      (TTL expires) → AVAILABLE
```

#### `seat_locks`

**Purpose:** Track seat reservations (fallback to Redis)

| Column       | Type        | Description            |
| ------------ | ----------- | ---------------------- |
| `id`         | UUID        | Primary key            |
| `seat_id`    | UUID        | FK → seats.id (UNIQUE) |
| `event_id`   | UUID        | For indexing           |
| `session_id` | VARCHAR(64) | User session ID        |
| `expires_at` | DATETIME    | Lock expiration        |

**Note:** Primary locking is in Redis. This table is backup only.

---

### 💰 Order & Payment Tables

#### `orders`

**Purpose:** Ticket orders

| Column              | Type          | Description                                    |
| ------------------- | ------------- | ---------------------------------------------- |
| `id`                | UUID          | Primary key                                    |
| `order_number`      | VARCHAR(50)   | UNIQUE display ID (e.g., "TKH123ABC")          |
| `user_id`           | UUID          | FK → users.id (NULLABLE for guests)            |
| `event_id`          | UUID          | FK → events.id                                 |
| `total_amount`      | DECIMAL(10,2) | Order total                                    |
| `status`            | VARCHAR(20)   | PENDING, PENDING_CONFIRMATION, PAID, CANCELLED |
| `customer_email`    | VARCHAR(100)  | Customer email                                 |
| `customer_name`     | VARCHAR(100)  | Customer name                                  |
| `customer_phone`    | VARCHAR(20)   | Customer phone                                 |
| `access_token`      | VARCHAR(64)   | Plaintext ticket access token                  |
| `access_token_hash` | VARCHAR(64)   | SHA-256 hash for verification                  |
| `qr_code_url`       | VARCHAR(500)  | Generated QR code                              |
| `checked_in_at`     | DATETIME      | Check-in timestamp                             |
| `checked_in_by`     | UUID          | FK → users.id (staff)                          |

**Indexes:**

- `order_number` - UNIQUE lookup
- `customer_email` - Customer order history
- `status` - Filter by status
- `checked_in_at` - Check-in reports

**Order Status Flow:**

```
PENDING → Payment gateway → PENDING_CONFIRMATION → Admin confirm → PAID
       ↓
  (Expired) → CANCELLED
```

**Access Token Security:**

- Plaintext stored for email links (UX decision)
- Hash stored for verification
- Each resend generates new token (old invalidated)

#### `order_items`

**Purpose:** Line items in orders

| Column        | Type          | Description                     |
| ------------- | ------------- | ------------------------------- |
| `id`          | UUID          | Primary key                     |
| `order_id`    | UUID          | FK → orders.id (CASCADE DELETE) |
| `seat_id`     | UUID          | FK → seats.id (NULLABLE)        |
| `price`       | DECIMAL(10,2) | Price at purchase time          |
| `seat_number` | VARCHAR(20)   | Denormalized for history        |
| `seat_type`   | VARCHAR(20)   | Denormalized for history        |

**Why denormalized seat info?**

- Seats might be deleted/changed
- Need historical record of what was sold

#### `payments`

**Purpose:** Payment transactions

| Column               | Type          | Description                          |
| -------------------- | ------------- | ------------------------------------ |
| `id`                 | UUID          | Primary key                          |
| `order_id`           | UUID          | FK → orders.id (UNIQUE)              |
| `payment_method`     | VARCHAR(30)   | BANK_TRANSFER, VNPAY, MOMO           |
| `amount`             | DECIMAL(10,2) | Payment amount                       |
| `status`             | VARCHAR(20)   | PENDING, COMPLETED, FAILED, REFUNDED |
| `transaction_id`     | VARCHAR(100)  | Gateway transaction ID (UNIQUE)      |
| `payment_gateway`    | VARCHAR(50)   | Gateway name                         |
| `payment_session_id` | VARCHAR(100)  | Gateway session (UNIQUE)             |
| `webhook_received`   | BOOLEAN       | Webhook flag                         |
| `webhook_processed`  | BOOLEAN       | Processing flag                      |
| `webhook_data`       | TEXT          | Raw webhook JSON                     |
| `paid_at`            | DATETIME      | Payment timestamp                    |

**Idempotency:**

- `transaction_id` - UNIQUE prevents double-processing
- `webhook_processed` - Processing flag

---

### 📧 Email & Audit Tables

#### `email_templates`

**Purpose:** HTML email templates

| Column         | Type         | Description                      |
| -------------- | ------------ | -------------------------------- |
| `id`           | UUID         | Primary key                      |
| `name`         | VARCHAR(100) | Template name (UNIQUE)           |
| `purpose`      | VARCHAR(50)  | TICKET_CONFIRMED, REMINDER, etc. |
| `subject`      | VARCHAR(200) | Email subject                    |
| `html_content` | TEXT         | HTML template with {{variables}} |
| `is_active`    | BOOLEAN      | Active flag                      |

**Template Variables:**

- `{{customerName}}` - Customer name
- `{{orderNumber}}` - Order number
- `{{ticketUrl}}` - Ticket view URL
- `{{qrCodeUrl}}` - QR code image

#### `email_logs`

**Purpose:** Email sending history

| Column          | Type         | Description                        |
| --------------- | ------------ | ---------------------------------- |
| `id`            | UUID         | Primary key                        |
| `order_id`      | UUID         | FK → orders.id (NULLABLE)          |
| `template_id`   | UUID         | FK → email_templates.id (NULLABLE) |
| `purpose`       | VARCHAR(50)  | Email purpose                      |
| `recipient`     | VARCHAR(100) | Email address                      |
| `subject`       | VARCHAR(200) | Email subject                      |
| `status`        | VARCHAR(20)  | SENT, FAILED, BOUNCED              |
| `email_id`      | VARCHAR(100) | Provider email ID                  |
| `error_message` | TEXT         | Error if failed                    |
| `sent_at`       | DATETIME     | Send timestamp                     |

**Use Cases:**

- Debug email issues
- Resend emails
- Audit trail

#### `audit_logs`

**Purpose:** Admin action tracking

| Column        | Type         | Description                             |
| ------------- | ------------ | --------------------------------------- |
| `id`          | UUID         | Primary key                             |
| `user_id`     | UUID         | FK → users.id                           |
| `action`      | VARCHAR(50)  | CREATE, UPDATE, DELETE, CONFIRM_PAYMENT |
| `entity_type` | VARCHAR(50)  | Event, Order, User, etc.                |
| `entity_id`   | VARCHAR(36)  | Entity UUID                             |
| `old_value`   | TEXT         | JSON before change                      |
| `new_value`   | TEXT         | JSON after change                       |
| `ip_address`  | VARCHAR(45)  | Request IP                              |
| `user_agent`  | VARCHAR(255) | Request user agent                      |

---

## 🔑 Indexes & Performance

### Index Strategy

**Primary Indexes (Automatic):**

- All `id` fields (PK)
- All UNIQUE constraints

**Secondary Indexes (Explicit):**

```sql
-- Fast order lookup
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_status ON orders(status);

-- Seat availability check
CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_seats_type ON seats(seat_type);

-- Payment lookup
CREATE INDEX idx_payments_transaction ON payments(transaction_id);
CREATE INDEX idx_payments_session ON payments(payment_session_id);

-- Email debugging
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX idx_email_logs_status ON email_logs(status);
```

### Query Performance Tips

**✅ Fast Queries:**

```sql
-- Uses idx_orders_order_number
SELECT * FROM orders WHERE order_number = 'TKH123';

-- Uses idx_seats_event_status
SELECT * FROM seats WHERE event_id = ? AND status = 'AVAILABLE';
```

**❌ Slow Queries (Avoid):**

```sql
-- Full table scan
SELECT * FROM orders WHERE customer_name LIKE '%John%';

-- No index on created_at
SELECT * FROM orders WHERE DATE(created_at) = '2026-06-13';
```

---

## 🔄 Migration Strategy

### Prisma Migrate Workflow

```bash
# 1. Make schema changes
vim prisma/schema.prisma

# 2. Create migration (dev)
npx prisma migrate dev --name add_access_token_column

# 3. Review generated SQL
cat prisma/migrations/XXX_add_access_token_column/migration.sql

# 4. Deploy to production
npx prisma migrate deploy
```

### Migration Best Practices

**✅ Safe Migrations:**

- Add nullable columns first
- Backfill data in separate step
- Make column NOT NULL after backfill
- Use transactions for multi-step changes

**❌ Dangerous Migrations:**

- Don't drop columns with data
- Don't change column types directly
- Don't remove indexes during peak hours

**Example Safe Migration:**

```sql
-- Step 1: Add nullable column
ALTER TABLE orders ADD COLUMN access_token VARCHAR(64) NULL;

-- Step 2: Backfill (application code or script)
-- UPDATE orders SET access_token = generate_token() WHERE access_token IS NULL;

-- Step 3: Make NOT NULL (future migration)
-- ALTER TABLE orders MODIFY access_token VARCHAR(64) NOT NULL;
```

---

## 📊 Data Volume Estimates

| Table         | Rows/Event | Total (10 Events) | Growth                      |
| ------------- | ---------- | ----------------- | --------------------------- |
| `events`      | 1          | 10                | Low                         |
| `seats`       | 500        | 5,000             | Linear with events          |
| `orders`      | 300        | 3,000             | Linear with events          |
| `order_items` | 600        | 6,000             | 2x orders (avg 2 seats)     |
| `payments`    | 300        | 3,000             | 1:1 with paid orders        |
| `email_logs`  | 900        | 9,000             | 3x orders (multiple emails) |
| `audit_logs`  | 1,000      | 10,000            | High (every admin action)   |

**Storage:** ~50MB per event (with indexes)

---

## 🔒 Data Integrity Rules

### Foreign Key Constraints

```prisma
// Cascade delete - delete children when parent deleted
model OrderItem {
  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
}

// Set null - preserve children, null out FK
model Order {
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

### Unique Constraints

- `users.username` - No duplicate usernames
- `users.email` - No duplicate emails
- `events.slug` - URL-safe unique identifier
- `orders.order_number` - Display ID
- `seats(event_id, seat_number)` - Composite unique

---

**Next:** [Business Flows →](./04-business-flows.md)

## 📈 Data Volume Estimates

| Table         | Rows/Event | Total (10 Events) | Growth                      |
| ------------- | ---------- | ----------------- | --------------------------- |
| `events`      | 1          | 10                | Low                         |
| `seats`       | 500        | 5,000             | Linear with events          |
| `orders`      | 300        | 3,000             | Linear with events          |
| `order_items` | 600        | 6,000             | 2x orders (avg 2 seats)     |
| `payments`    | 300        | 3,000             | 1:1 with paid orders        |
| `email_logs`  | 900        | 9,000             | 3x orders (multiple emails) |
| `audit_logs`  | 1,000      | 10,000            | High (every admin action)   |

**Storage:** ~50MB per event (with indexes)

---

## 🔒 Data Integrity Rules

### Foreign Key Constraints

```prisma
// Cascade delete - delete children when parent deleted
model OrderItem {
  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
}

// Set null - preserve children, null out FK
model Order {
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

### Unique Constraints

- `users.username` - No duplicate usernames
- `users.email` - No duplicate emails
- `events.slug` - URL-safe unique identifier
- `orders.order_number` - Display ID
- `seats(event_id, seat_number)` - Composite unique

---

**Next:** [Business Flows →](./04-business-flows.md)
