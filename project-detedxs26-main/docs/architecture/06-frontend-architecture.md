# Frontend Architecture

> **🎯 For:** Frontend developers  
> **📅 Last Updated:** 2026-06-13  
> **🔗 Previous:** [API Reference](./05-api-reference.md) | **Next:** [Security Model](./07-security-model.md)

---

## 📱 Frontend Applications

The platform consists of **2 Next.js applications**:

| App | Port | Purpose | Users |
|-----|------|---------|-------|
| **Client** | 3000 | Public ticketing website | End users |
| **Admin** | 3002 | Admin dashboard | Staff, Admins |

---

## 🎨 Client App (Public Ticketing)

**Framework:** Next.js 14 (App Router)  
**Styling:** Tailwind CSS  
**State:** React Context + Zustand  
**Forms:** React Hook Form + Zod

### Project Structure

```
client/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Homepage
│   │   ├── events/
│   │   │   └── [slug]/
│   │   │       └── page.tsx    # Event detail + seat selection
│   │   ├── checkout/
│   │   │   └── page.tsx        # Checkout page
│   │   ├── ticket/
│   │   │   └── view/
│   │   │       └── page.tsx    # Ticket view page
│   │   └── layout.tsx          # Root layout
│   │
│   ├── components/
│   │   ├── ui/                 # Shadcn/ui components
│   │   ├── SeatMap.tsx         # Interactive seat selector
│   │   ├── CheckoutForm.tsx    # Customer info form
│   │   └── TicketDisplay.tsx   # Ticket view with QR
│   │
│   ├── lib/
│   │   ├── api.ts              # API client
│   │   ├── validation.ts       # Zod schemas
│   │   └── utils.ts            # Helpers
│   │
│   └── stores/
│       ├── seatStore.ts        # Seat selection state (Zustand)
│       └── orderStore.ts       # Order state
│
├── public/
└── next.config.js
```

### Key Features

#### 1. Seat Selection Component

```tsx
// components/SeatMap.tsx
'use client'
import { useSeatStore } from '@/stores/seatStore'

export function SeatMap({ seats }: { seats: Seat[] }) {
  const { selectedSeats, toggleSeat, lockSeats } = useSeatStore()
  
  const handleSeatClick = (seat: Seat) => {
    if (seat.status !== 'AVAILABLE') return
    toggleSeat(seat.id)
  }
  
  const handleLock = async () => {
    await lockSeats(selectedSeats)
    router.push('/checkout')
  }
  
  return (
    <div className="seat-map-grid">
      {seats.map(seat => (
        <SeatButton
          key={seat.id}
          seat={seat}
          selected={selectedSeats.includes(seat.id)}
          onClick={() => handleSeatClick(seat)}
        />
      ))}
      <button onClick={handleLock}>Continue to Checkout</button>
    </div>
  )
}
```

#### 2. Zustand State Management

```ts
// stores/seatStore.ts
import { create } from 'zustand'

interface SeatState {
  selectedSeats: string[]
  sessionId: string
  lockedUntil: Date | null
  toggleSeat: (seatId: string) => void
  lockSeats: (seatIds: string[]) => Promise<void>
}

export const useSeatStore = create<SeatState>((set, get) => ({
  selectedSeats: [],
  sessionId: generateSessionId(),
  lockedUntil: null,
  
  toggleSeat: (seatId) => {
    set((state) => ({
      selectedSeats: state.selectedSeats.includes(seatId)
        ? state.selectedSeats.filter(id => id !== seatId)
        : [...state.selectedSeats, seatId]
    }))
  },
  
  lockSeats: async (seatIds) => {
    const response = await api.post('/seats/lock', {
      seatIds,
      sessionId: get().sessionId
    })
    set({ lockedUntil: new Date(response.data.expiresAt) })
  }
}))
```

---

## 🔧 Admin App

**Framework:** Next.js 14 (App Router)  
**UI Library:** Ant Design (antd)  
**State:** React Query (TanStack Query)  
**Auth:** JWT in localStorage

### Project Structure

```
admin/
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx      # Authenticated layout
│   │   │   ├── orders/
│   │   │   │   └── page.tsx    # Order list
│   │   │   ├── events/
│   │   │   │   └── page.tsx    # Event management
│   │   │   └── check-in/
│   │   │       └── page.tsx    # QR scanner
│   │
│   ├── components/
│   │   ├── OrderTable.tsx
│   │   ├── QRScanner.tsx
│   │   └── ConfirmPaymentModal.tsx
│   │
│   ├── lib/
│   │   ├── api.ts              # Axios client with auth
│   │   └── auth.ts             # Auth helpers
│   │
│   └── hooks/
│       ├── useOrders.ts        # React Query hook
│       └── useAuth.ts          # Auth hook
```

### Key Features

#### 1. Order Management Table

```tsx
// app/(dashboard)/orders/page.tsx
'use client'
import { Table, Button, Tag } from 'antd'
import { useOrders } from '@/hooks/useOrders'

export default function OrdersPage() {
  const { data, isLoading, refetch } = useOrders({ status: 'PENDING_CONFIRMATION' })
  
  const handleConfirm = async (orderId: string) => {
    await api.post(`/admin/orders/${orderId}/confirm-payment`)
    refetch()
  }
  
  const columns = [
    { title: 'Order #', dataIndex: 'orderNumber' },
    { title: 'Customer', dataIndex: 'customerName' },
    { title: 'Amount', dataIndex: 'totalAmount', render: (v) => formatVND(v) },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => <Tag color={statusColor(status)}>{status}</Tag>
    },
    {
      title: 'Actions',
      render: (_, record) => (
        <Button onClick={() => handleConfirm(record.id)}>Confirm</Button>
      )
    }
  ]
  
  return <Table dataSource={data?.orders} columns={columns} loading={isLoading} />
}
```

#### 2. QR Code Scanner

```tsx
// components/QRScanner.tsx
'use client'
import { Scanner } from '@yudiel/react-qr-scanner'

export function QRScanner() {
  const [result, setResult] = useState<string | null>(null)
  
  const handleScan = async (data: string) => {
    // Parse: "ORDER:TKH123:TOKEN:abc..."
    const [, orderNumber, , token] = data.split(':')
    
    try {
      const response = await api.post('/tickets/check-in', {
        orderNumber,
        token
      })
      
      notification.success({
        message: 'Check-in Successful',
        description: `Welcome ${response.data.customerName}!`
      })
    } catch (error) {
      notification.error({
        message: 'Check-in Failed',
        description: error.response?.data?.error
      })
    }
  }
  
  return (
    <Scanner
      onScan={(result) => handleScan(result[0].rawValue)}
      components={{ audio: true }}
    />
  )
}
```

---

## 🔗 API Integration

### Axios Client with Interceptors

```ts
// lib/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
})

// Request interceptor (add auth token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor (handle errors)
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

---

## 🎨 Styling & UI Patterns

### Tailwind Config (Client)

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: '#E62B1E', // TEDx red
        secondary: '#000000'
      }
    }
  }
}
```

### Responsive Design

All pages are mobile-first responsive using Tailwind breakpoints:

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
  {/* Seat grid */}
</div>
```

---

**Next:** [Security Model →](./07-security-model.md)
