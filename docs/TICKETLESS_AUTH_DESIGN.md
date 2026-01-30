# LUỒNG XEM VÉ KHÔNG CẦN ĐĂNG NHẬP

## 1. TỔNG QUAN

Người dùng không cần tạo tài khoản để mua và xem vé. Mỗi đơn hàng (Order) sẽ có một access token bí mật để truy cập.

### Luồng hoạt động:

```
User chọn ghế → Tạo Order + Token → Nhận link vé
              → Chuyển khoản → Admin confirm
              → Vé CONFIRMED → Check-in bằng QR
```

---

## 2. DATABASE SCHEMA

### Thêm cột vào bảng `orders`:

```sql
ALTER TABLE orders
ADD COLUMN access_token_hash VARCHAR(128) NULL COMMENT 'SHA-256 hash of access token',
ADD COLUMN checked_in_at DATETIME NULL COMMENT 'Check-in timestamp',
ADD COLUMN checked_in_by VARCHAR(36) NULL COMMENT 'Staff user ID who checked in',
ADD INDEX idx_access_token_hash (access_token_hash);
```

### Prisma Schema Update:

```prisma
model Order {
  // ... existing fields ...

  // Token-based access (không cần login)
  accessTokenHash    String?   @map("access_token_hash") @db.VarChar(128)

  // Check-in tracking
  checkedInAt        DateTime? @map("checked_in_at")
  checkedInBy        String?   @map("checked_in_by") @db.VarChar(36)

  @@index([accessTokenHash])
}
```

---

## 3. TOKEN LOGIC

### Token Structure:

- **orderNumber**: Public, ngắn (e.g., `TKH5T69US`) - dùng để hiển thị
- **accessToken**: Private, random 32 bytes hex (64 chars) - bí mật
- **accessTokenHash**: SHA-256 hash của accessToken - lưu trong DB

### Hàm Utility:

```typescript
// web-client/src/lib/ticket-token.ts

import crypto from "crypto";

/**
 * Generate secure random access token
 * Returns: { token: string, hash: string }
 */
export function generateAccessToken(): { token: string; hash: string } {
  // 32 bytes = 256 bits entropy
  const token = crypto.randomBytes(32).toString("hex");
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * Hash token using SHA-256
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verify token against hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const inputHash = hashToken(token);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hash));
}

/**
 * Generate ticket access URL
 */
export function generateTicketUrl(orderNumber: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/ticket/${orderNumber}?token=${token}`;
}
```

---

## 4. API ENDPOINTS

### 4.1 Cập nhật API tạo Order

**File**: `web-client/src/app/api/orders/route.ts`

Khi tạo order:

1. Generate accessToken
2. Lưu accessTokenHash vào DB
3. Trả về ticketUrl chứa token

```typescript
// POST /api/orders
const { token, hash } = generateAccessToken();

await execute(
  `INSERT INTO orders (..., access_token_hash) VALUES (..., ?)`,
  [..., hash]
);

return {
  success: true,
  data: {
    orderNumber,
    ticketUrl: generateTicketUrl(orderNumber, token),
    // ...
  }
};
```

### 4.2 API Xem Vé (Public)

**Route**: `GET /api/ticket/[orderNumber]?token=xxx`

```typescript
// web-client/src/app/api/ticket/[orderNumber]/route.ts

export async function GET(request: NextRequest, { params }) {
  const { orderNumber } = await params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 401 });
  }

  // Rate limiting check
  // ...

  // Find order
  const order = await queryOne(
    `SELECT * FROM orders WHERE order_number = ?`,
    [orderNumber]
  );

  if (!order || !order.access_token_hash) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Verify token
  if (!verifyToken(token, order.access_token_hash)) {
    // Log failed attempt for security
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  // Return ticket data based on status
  return NextResponse.json({
    success: true,
    data: {
      orderNumber: order.order_number,
      status: order.status,
      customerName: order.customer_name,
      event: { ... },
      seats: [ ... ],
      canDownload: order.status === 'PAID',
      qrCodeUrl: order.status === 'PAID' ? order.qr_code_url : null,
      checkedIn: !!order.checked_in_at,
    }
  });
}
```

### 4.3 API Check-in (Admin/Staff)

**Route**: `POST /api/admin/orders/[id]/check-in`

```typescript
export async function POST(request: NextRequest, { params }) {
  // Verify admin/staff auth
  const user = await getAuthUser(request);
  if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status !== 'PAID') {
    return NextResponse.json({ error: 'Order not confirmed' }, { status: 400 });
  }

  if (order.checkedInAt) {
    return NextResponse.json({
      error: 'Already checked in',
      checkedInAt: order.checkedInAt
    }, { status: 409 });
  }

  // Update check-in
  await prisma.order.update({
    where: { id },
    data: {
      checkedInAt: new Date(),
      checkedInBy: user.id,
    }
  });

  // Audit log
  await createAuditLog({
    userId: user.id,
    action: 'CHECK_IN',
    entity: 'ORDER',
    entityId: id,
    ...
  });

  return NextResponse.json({ success: true });
}
```

---

## 5. SECURITY MEASURES

### 5.1 Chống Brute Force / Token Guessing

```typescript
// Rate limiting per IP
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // max 10 ticket views per IP per window
};

// In-memory store (use Redis in production)
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || now > record.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return false; // Rate limited
  }

  record.count++;
  return true;
}
```

### 5.2 Token Entropy

- **32 bytes = 256 bits entropy**
- Probability of guessing: `1 / 2^256` ≈ impossible
- Combined with orderNumber makes it even harder

### 5.3 Secure Storage

- **NEVER** log or expose plain token
- Only hash stored in DB
- Token only shown once at order creation
- User must save their ticket link

### 5.4 Failed Attempt Logging

```typescript
// Log failed token attempts
if (!verifyToken(token, order.access_token_hash)) {
  await execute(
    `INSERT INTO security_logs (ip, order_number, event, created_at)
     VALUES (?, ?, 'INVALID_TICKET_TOKEN', NOW())`,
    [ip, orderNumber],
  );

  // Check for suspicious patterns
  const recentFailures = await query(
    `SELECT COUNT(*) as count FROM security_logs
     WHERE ip = ? AND event = 'INVALID_TICKET_TOKEN'
     AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [ip],
  );

  if (recentFailures[0].count > 20) {
    // Block IP temporarily or alert admin
  }

  return NextResponse.json({ error: "Invalid token" }, { status: 403 });
}
```

---

## 6. CLIENT PAGES

### 6.1 Trang Xem Vé

**Route**: `/ticket/[orderNumber]`

```tsx
// web-client/src/app/ticket/[orderNumber]/page.tsx

export default function TicketPage({ params, searchParams }) {
  const { orderNumber } = params;
  const token = searchParams.token;

  // Fetch ticket data
  const { data, error, isLoading } = useSWR(
    `/api/ticket/${orderNumber}?token=${token}`,
  );

  if (error) return <AccessDenied />;
  if (isLoading) return <Loading />;

  const ticket = data.data;

  return (
    <div className="min-h-screen bg-black">
      {/* Event Banner */}
      <div className="relative h-48 bg-gradient-to-b from-red-600 to-black">
        <h1 className="text-3xl font-bold text-white">{ticket.event.name}</h1>
      </div>

      {/* Ticket Status Badge */}
      <TicketStatusBadge status={ticket.status} />

      {/* Ticket Details */}
      <div className="p-6 space-y-4">
        <InfoRow label="Mã vé" value={ticket.orderNumber} />
        <InfoRow label="Khách hàng" value={ticket.customerName} />
        <InfoRow label="Ngày" value={formatDate(ticket.event.date)} />
        <InfoRow label="Địa điểm" value={ticket.event.venue} />

        {/* Seats */}
        <div className="grid grid-cols-2 gap-2">
          {ticket.seats.map((seat) => (
            <SeatBadge key={seat.id} seat={seat} />
          ))}
        </div>
      </div>

      {/* QR Code (only if CONFIRMED) */}
      {ticket.canDownload && (
        <div className="text-center p-6">
          <img
            src={ticket.qrCodeUrl}
            alt="QR Code"
            className="w-48 h-48 mx-auto"
          />
          <p className="text-sm text-gray-400 mt-2">Quét mã để check-in</p>

          <DownloadTicketButton orderNumber={orderNumber} token={token} />
        </div>
      )}

      {/* Check-in Status */}
      {ticket.checkedIn && (
        <div className="bg-green-500/20 p-4 text-center">
          <Check className="w-8 h-8 text-green-500 mx-auto" />
          <p className="text-green-400">Đã check-in</p>
        </div>
      )}

      {/* Pending Status Warning */}
      {ticket.status === "PENDING" && (
        <div className="bg-yellow-500/20 p-4">
          <Clock className="w-6 h-6 text-yellow-500" />
          <p className="text-yellow-400">Vé đang chờ xác nhận thanh toán</p>
        </div>
      )}
    </div>
  );
}
```

### 6.2 Component TicketStatusBadge

```tsx
function TicketStatusBadge({ status }) {
  const config = {
    PENDING: { color: "yellow", text: "Chờ thanh toán", icon: Clock },
    PAID: { color: "green", text: "Đã xác nhận", icon: CheckCircle },
    CANCELLED: { color: "red", text: "Đã hủy", icon: XCircle },
    EXPIRED: { color: "gray", text: "Hết hạn", icon: AlertTriangle },
  };

  const { color, text, icon: Icon } = config[status] || config.PENDING;

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-${color}-500/20`}
    >
      <Icon className={`w-5 h-5 text-${color}-500`} />
      <span className={`font-medium text-${color}-500`}>{text}</span>
    </div>
  );
}
```

---

## 7. CHECK-IN FLOW

### 7.1 QR Code Content

QR code chứa URL đầy đủ để staff scan và verify:

```typescript
const qrContent = `${baseUrl}/admin/check-in?order=${orderNumber}`;
// Hoặc đơn giản hơn chỉ chứa orderNumber
const qrContent = orderNumber;
```

### 7.2 Staff Check-in Page

**Route**: `/admin/check-in`

```tsx
// web-admin/src/app/admin/check-in/page.tsx

export default function CheckInPage() {
  const [scanResult, setScanResult] = useState(null);
  const [orderData, setOrderData] = useState(null);

  const handleScan = async (orderNumber) => {
    // Fetch order by orderNumber
    const res = await fetch(`/api/admin/orders/by-number/${orderNumber}`);
    const data = await res.json();
    setOrderData(data);
  };

  const handleCheckIn = async () => {
    if (!orderData) return;

    const res = await fetch(`/api/admin/orders/${orderData.id}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      message.success("Check-in thành công!");
      setOrderData(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Check-in Sự kiện</h1>

        {/* QR Scanner */}
        <QRScanner onResult={handleScan} />

        {/* Manual Input */}
        <Input.Search placeholder="Nhập mã vé..." onSearch={handleScan} />

        {/* Order Preview */}
        {orderData && (
          <Card className="mt-6">
            <Descriptions>
              <Descriptions.Item label="Mã vé">
                {orderData.orderNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {orderData.customerName}
              </Descriptions.Item>
              <Descriptions.Item label="Ghế">
                {orderData.seats.map((s) => s.seatNumber).join(", ")}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={orderData.status === "PAID" ? "green" : "red"}>
                  {orderData.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {orderData.status === "PAID" && !orderData.checkedInAt && (
              <Button type="primary" size="large" onClick={handleCheckIn}>
                ✓ Check-in
              </Button>
            )}

            {orderData.checkedInAt && (
              <Alert type="warning" message="Đã check-in trước đó!" />
            )}
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
```

---

## 8. MIGRATION SCRIPT

```javascript
// web-admin/scripts/migrate-ticket-token.mjs

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: ".env.local" });

const dbUrl = new URL(process.env.DATABASE_URL);

const conn = await mysql.createConnection({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
});

console.log("🔧 Adding ticket token columns to orders table...");

// Add new columns
await conn.execute(`
  ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS access_token_hash VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS checked_in_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS checked_in_by VARCHAR(36) NULL
`);

// Add index
await conn.execute(`
  CREATE INDEX IF NOT EXISTS idx_access_token_hash ON orders(access_token_hash)
`);

// Generate tokens for existing PAID orders
const [orders] = await conn.execute(
  `SELECT id, order_number FROM orders WHERE status = 'PAID' AND access_token_hash IS NULL`,
);

console.log(`📝 Generating tokens for ${orders.length} existing orders...`);

for (const order of orders) {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  await conn.execute(`UPDATE orders SET access_token_hash = ? WHERE id = ?`, [
    hash,
    order.id,
  ]);

  console.log(
    `  ✅ ${order.order_number}: Token generated (send email with new link)`,
  );
}

console.log("✅ Migration complete!");
await conn.end();
```

---

## 9. SUMMARY

| Component          | File/Location                                               |
| ------------------ | ----------------------------------------------------------- |
| Token Utils        | `web-client/src/lib/ticket-token.ts`                        |
| Order API (update) | `web-client/src/app/api/orders/route.ts`                    |
| Ticket View API    | `web-client/src/app/api/ticket/[orderNumber]/route.ts`      |
| Ticket View Page   | `web-client/src/app/ticket/[orderNumber]/page.tsx`          |
| Check-in API       | `web-admin/src/app/api/admin/orders/[id]/check-in/route.ts` |
| Check-in Page      | `web-admin/src/app/admin/check-in/page.tsx`                 |
| Migration          | `web-admin/scripts/migrate-ticket-token.mjs`                |
| Prisma Schema      | Add fields to Order model                                   |
