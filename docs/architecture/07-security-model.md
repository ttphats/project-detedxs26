# Security Model

> **🎯 For:** All developers  
> **📅 Last Updated:** 2026-06-13  
> **🔗 Previous:** [Frontend Architecture](./06-frontend-architecture.md) | **Next:** [Development Guide](./08-development-guide.md)

---

## 🔐 Authentication & Authorization

### JWT Authentication

**Implementation:** JSON Web Tokens (JWT)  
**Algorithm:** HS256  
**Expiration:** 7 days  
**Storage:** LocalStorage (admin), Memory only (client)

#### Token Structure

```json
{
  "userId": "uuid",
  "username": "admin",
  "role": "ADMIN",
  "iat": 1686650000,
  "exp": 1687254800
}
```

#### Token Generation

```typescript
// utils/auth.ts
import jwt from 'jsonwebtoken'

export function generateJWT(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role.name
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )
}

export function verifyJWT(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!)
}
```

---

## 🛡️ Role-Based Access Control (RBAC)

### Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| `SUPER_ADMIN` | Full system access | System administrators |
| `ADMIN` | Manage events, orders, confirm payments | Event organizers |
| `STAFF` | Check-in tickets only | Door staff |
| `USER` | View own tickets (future) | Customers |

### Implementation

```typescript
// middleware/auth.ts
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user
    
    if (!user) {
      throw new UnauthorizedError('Not authenticated')
    }
    
    if (!allowedRoles.includes(user.role.name)) {
      throw new ForbiddenError('Insufficient permissions')
    }
  }
}

// Usage in routes
fastify.delete('/api/admin/events/:id', {
  preHandler: [requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN'])]
}, deleteEvent)
```

---

## 🎫 Ticket Access Token Security

### Token Design

**Format:** 64-character hexadecimal string  
**Generation:** `crypto.randomBytes(32).toString('hex')`  
**Storage:** 
- Plaintext in `orders.access_token` (for email links)
- SHA-256 hash in `orders.access_token_hash` (for verification)

### Why Store Plaintext?

**Trade-off decision:** UX vs. Security

**Pros:**
- ✅ Links remain valid after admin confirmation
- ✅ Easier customer support (resend same link)
- ✅ Simpler implementation

**Cons:**
- ❌ Database breach exposes tokens
- ❌ Internal staff can view tokens

**Mitigation:**
- 🔒 Database access restricted
- 🔒 Audit logs for all token access
- 🔒 Tokens are order-specific (not user accounts)

### Token Verification

```typescript
import crypto from 'crypto'

export function generateAccessToken() {
  const token = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, hash }
}

export function verifyAccessToken(token: string, hash: string): boolean {
  const computedHash = crypto.createHash('sha256').update(token).digest('hex')
  return computedHash === hash
}
```

---

## 🔒 API Security

### 1. CORS Configuration

```typescript
// src/index.ts
import cors from '@fastify/cors'

fastify.register(cors, {
  origin: [
    'http://localhost:3000',  // Client
    'http://localhost:3002',  // Admin
    'https://tedxfptuhcm.com'
  ],
  credentials: true
})
```

### 2. Helmet (Security Headers)

```typescript
import helmet from '@fastify/helmet'

fastify.register(helmet, {
  contentSecurityPolicy: false // Disabled for development
})
```

### 3. Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit'

fastify.register(rateLimit, {
  max: 100,           // Max requests
  timeWindow: '1 minute'
})

// Stricter limit for sensitive endpoints
fastify.post('/api/auth/login', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute'
    }
  }
}, loginHandler)
```

### 4. Input Validation (Zod)

```typescript
import { z } from 'zod'

const createOrderSchema = z.object({
  eventId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1).max(10),
  customerEmail: z.string().email(),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().regex(/^0\d{9}$/).optional()
})

// In controller
const validated = createOrderSchema.parse(request.body)
```

---

## 🚨 Common Security Threats & Mitigation

### 1. SQL Injection

**Protection:** Prisma ORM (parameterized queries)

```typescript
// ❌ Vulnerable (raw SQL with concatenation)
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM orders WHERE id = '${orderId}'`
)

// ✅ Safe (parameterized)
const result = await prisma.order.findUnique({
  where: { id: orderId }
})
```

### 2. XSS (Cross-Site Scripting)

**Protection:**
- React auto-escapes JSX output
- Never use `dangerouslySetInnerHTML` without sanitization
- Content Security Policy (CSP) headers

```tsx
// ❌ Dangerous
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Safe (auto-escaped)
<div>{userInput}</div>
```

### 3. CSRF (Cross-Site Request Forgery)

**Protection:**
- SameSite cookies (not used - JWT in headers only)
- JWT in Authorization header (not cookie)
- Origin validation

### 4. Seat Lock Race Condition

**Protection:** Redis atomic operations

```typescript
// ✅ Atomic (SET NX = only if not exists)
const result = await redis.set(key, sessionId, 'EX', 300, 'NX')

// ❌ Non-atomic (race condition)
const exists = await redis.get(key)
if (!exists) {
  await redis.set(key, sessionId)
}
```

### 5. Payment Webhook Forgery

**Protection:** Signature verification

```typescript
export function verifyWebhookSignature(payload: any, signature: string): boolean {
  const computed = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(JSON.stringify(payload))
    .digest('hex')
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  )
}
```

---

## 🔑 Environment Variables Security

### Sensitive Variables

```env
# ❌ NEVER commit to Git
DATABASE_URL=mysql://user:password@host/db
JWT_SECRET=super-secret-key-change-in-production
RESEND_API_KEY=re_xxx
CLOUDINARY_API_SECRET=xxx

# ✅ OK to commit (public)
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### Best Practices

1. **Use `.env.example`** for template
2. **Never log secrets** in production
3. **Rotate secrets** periodically
4. **Different secrets** per environment

---

## 📝 Audit Logging

### What to Log

```typescript
await prisma.auditLog.create({
  data: {
    userId: request.user.id,
    action: 'CONFIRM_PAYMENT',
    entityType: 'Order',
    entityId: orderId,
    oldValue: JSON.stringify(oldOrder),
    newValue: JSON.stringify(newOrder),
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']
  }
})
```

### Critical Actions to Audit

- ✅ Admin login attempts
- ✅ Order confirmation
- ✅ Payment refunds
- ✅ Ticket access (optional)
- ✅ Seat status changes

---

**Next:** [Development Guide →](./08-development-guide.md)
