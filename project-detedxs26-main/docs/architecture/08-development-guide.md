# Development Guide

> **🎯 For:** New developers (onboarding)  
> **📅 Last Updated:** 2026-06-13  
> **🔗 Previous:** [Security Model](./07-security-model.md) | **Next:** [Deployment Guide](./09-deployment-guide.md)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x or higher
- **MySQL** 8.0+
- **Redis** 6.x+
- **pnpm** or npm
- **Git**

### Initial Setup (15 minutes)

```bash
# 1. Clone repository
git clone <repository-url>
cd project-detedxs26

# 2. Install dependencies
cd backend && npm install
cd ../admin && npm install
cd ../client && npm install

# 3. Setup environment files
cp backend/.env.example backend/.env
cp admin/.env.example admin/.env
cp client/.env.example client/.env

# Edit .env files with your local configuration

# 4. Database setup
cd backend
npx prisma generate
npx prisma migrate dev

# 5. Seed database (optional)
npm run seed

# 6. Start services
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Admin
cd admin && npm run dev

# Terminal 3 - Client
cd client && npm run dev

# Terminal 4 - Redis (if not already running)
redis-server
```

### Verify Setup

- Backend: http://localhost:4000/health
- Admin: http://localhost:3002
- Client: http://localhost:3000

---

## 📁 Project Structure

```
project-detedxs26/
├── backend/              # Fastify API
│   ├── src/
│   ├── prisma/
│   ├── public/
│   └── package.json
│
├── admin/                # Admin dashboard (Next.js)
│   ├── src/
│   └── package.json
│
├── client/               # Public website (Next.js)
│   ├── src/
│   └── package.json
│
└── docs/
    ├── architecture/     # This documentation
    └── BUSINESS_FLOW.md
```

---

## 🛠️ Common Development Workflows

### 1. Adding a New API Endpoint

```bash
# 1. Define route
# backend/src/routes/public.routes.ts

fastify.post('/new-endpoint', newController.handleRequest)

# 2. Create controller
# backend/src/controllers/new.controller.ts

export async function handleRequest(req, reply) {
  const data = await newService.process(req.body)
  return reply.send({ success: true, data })
}

# 3. Create service
# backend/src/services/new.service.ts

export async function process(input) {
  // Business logic
  return await prisma.model.create({ data: input })
}

# 4. Test locally
curl http://localhost:4000/api/new-endpoint -X POST -d '{...}'
```

### 2. Database Schema Changes

```bash
# 1. Edit schema
vim backend/prisma/schema.prisma

# 2. Create migration
cd backend
npx prisma migrate dev --name add_new_column

# 3. Review generated SQL
cat prisma/migrations/XXXXX_add_new_column/migration.sql

# 4. Apply to dev database (auto-applied by migrate dev)

# 5. Regenerate Prisma client
npx prisma generate

# 6. Restart backend
npm run dev
```

### 3. Adding a Frontend Component

```tsx
// client/src/components/MyComponent.tsx

'use client'
import { useState } from 'react'

export function MyComponent() {
  const [state, setState] = useState('')
  
  return (
    <div className="p-4">
      {/* Component code */}
    </div>
  )
}

// Use in page
// client/src/app/my-page/page.tsx

import { MyComponent } from '@/components/MyComponent'

export default function Page() {
  return <MyComponent />
}
```

---

## 🧪 Testing

### Run Tests

```bash
# Backend tests
cd backend
npm run test

# Frontend tests
cd admin
npm run test
```

### Test Patterns

```typescript
// backend/src/__tests__/order.service.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createPendingOrder } from '../services/order.service'

describe('Order Service', () => {
  beforeEach(async () => {
    // Clean database
    await prisma.order.deleteMany()
  })
  
  it('should create pending order', async () => {
    const result = await createPendingOrder({
      eventId: 'test-event',
      seatIds: ['seat-1'],
      customerEmail: 'test@example.com'
    })
    
    expect(result.status).toBe('PENDING')
    expect(result.orderNumber).toMatch(/^TKH/)
  })
})
```

---

## 🐛 Debugging

### Backend Debugging (VS Code)

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

```typescript
// Backend
fastify.log.info({ orderId }, 'Order created')
fastify.log.error({ error }, 'Payment failed')

// Frontend
console.log('[SeatMap]', selectedSeats)
```

### Database Queries

```bash
# View generated queries
DATABASE_LOG=true npm run dev

# Prisma Studio (GUI)
cd backend
npx prisma studio
# Opens http://localhost:5555
```

---

## 🔧 Troubleshooting

### Common Issues

#### Issue 1: Prisma Client Not Generated

```bash
Error: Cannot find module '@prisma/client'

# Solution:
cd backend
npx prisma generate
```

#### Issue 2: Port Already in Use

```bash
Error: listen EADDRINUSE: address already in use :::4000

# Solution (find and kill process):
# Windows:
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:4000 | xargs kill -9
```

#### Issue 3: Redis Connection Failed

```bash
Error: connect ECONNREFUSED 127.0.0.1:6379

# Solution: Start Redis
redis-server

# Or on Windows with WSL:
wsl redis-server
```

#### Issue 4: Database Connection Error

```bash
Error: Can't reach database server

# Check connection string in .env
DATABASE_URL="mysql://user:password@localhost:3306/tedx_ticketing"

# Test connection:
mysql -h localhost -u user -p
```

---

## 📚 Code Style & Conventions

### TypeScript

```typescript
// ✅ Use explicit types
function processOrder(orderId: string): Promise<Order> {
  // ...
}

// ✅ Use interfaces for objects
interface CreateOrderInput {
  eventId: string
  seatIds: string[]
}

// ❌ Avoid 'any'
function process(data: any) {} // Bad
```

### Naming Conventions

```typescript
// Files: kebab-case
order.service.ts
seat-map.component.tsx

// Classes: PascalCase
class OrderService {}

// Functions: camelCase
function createOrder() {}

// Constants: UPPER_SNAKE_CASE
const MAX_SEATS_PER_ORDER = 10
```

### Git Commit Messages

```bash
# Format: type(scope): message

feat(backend): add order confirmation endpoint
fix(client): fix seat selection race condition
docs(architecture): update database schema diagram
refactor(admin): simplify order table component
```

---

## 🔄 Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/add-payment-webhook

# 2. Make changes and commit
git add .
git commit -m "feat(backend): add VNPay webhook handler"

# 3. Push to remote
git push origin feature/add-payment-webhook

# 4. Create Pull Request on GitHub

# 5. After review and approval, merge to main
```

---

## 📦 Package Management

### Adding Dependencies

```bash
# Backend
cd backend
npm install <package-name>

# Frontend
cd admin  # or client
npm install <package-name>
```

### Updating Dependencies

```bash
# Check outdated packages
npm outdated

# Update specific package
npm update <package-name>

# Update all (carefully!)
npm update
```

---

**Next:** [Deployment Guide →](./09-deployment-guide.md)
