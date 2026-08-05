# Playwright Test Plan - TEDx Ticketing System

## 🎯 Test Objectives
- Verify critical user journeys work end-to-end
- Ensure payment flow is secure and reliable
- Test seat selection and locking mechanism
- Validate email delivery and ticket generation

---

## 📊 Test Coverage Matrix

| Feature | Priority | Status | Tests |
|---------|----------|--------|-------|
| User Registration | High | ⏳ TODO | 3 |
| Event Browsing | Medium | ⏳ TODO | 2 |
| Seat Selection | Critical | ⏳ TODO | 5 |
| Payment Flow | Critical | ⏳ TODO | 6 |
| Ticket Download | High | ⏳ TODO | 3 |
| Admin Dashboard | Medium | ⏳ TODO | 4 |

---

## 🔄 Critical User Journeys

### Journey 1: Happy Path - Complete Purchase
**Priority:** Critical  
**User Story:** As a customer, I want to buy tickets successfully

**Steps:**
1. Navigate to event page
2. Select available seats (2 seats)
3. Fill in customer information
4. Complete payment (bank transfer)
5. Admin confirms payment
6. Receive email with tickets
7. Download PDF tickets

**Expected Result:** 
- Order status: CONFIRMED
- Email sent with QR codes
- PDF downloadable

**Test Files:**
- `e2e/purchase-flow.spec.ts`

---

### Journey 2: Seat Locking & Race Condition
**Priority:** Critical  
**User Story:** Prevent double booking when multiple users select same seat

**Steps:**
1. User A selects seat S1
2. User B tries to select seat S1 (should fail)
3. User A's lock expires after 10 minutes
4. User B can now select seat S1

**Expected Result:**
- Only one user can lock a seat at a time
- Locks expire automatically
- Visual feedback for unavailable seats

**Test Files:**
- `e2e/seat-locking.spec.ts`
- `e2e/concurrent-booking.spec.ts`

---

### Journey 3: Payment Confirmation Workflow
**Priority:** Critical  
**User Story:** Admin confirms pending payments

**Steps:**
1. Customer completes seat selection
2. Customer marks payment as sent
3. Admin sees order in pending list
4. Admin confirms payment
5. System sends email automatically
6. Order status changes to CONFIRMED

**Expected Result:**
- Order appears in admin dashboard
- Email sent on confirmation
- Seats locked permanently

**Test Files:**
- `e2e/admin-payment-confirmation.spec.ts`

---

## 🧪 Test Scenarios by Feature

### Seat Selection (5 tests)
1. ✅ Select single seat
2. ✅ Select multiple seats (max 4)
3. ❌ Cannot select locked seats
4. ❌ Cannot exceed maximum seats
5. ✅ Lock expires after timeout

### Payment Flow (6 tests)
1. ✅ Create pending order
2. ✅ Upload payment proof
3. ✅ Admin confirms payment
4. ❌ Cannot confirm already confirmed order
5. ❌ Cannot confirm expired order
6. ✅ Email sent after confirmation

### Ticket Download (3 tests)
1. ✅ Download PDF with QR code
2. ✅ QR code scans correctly
3. ❌ Cannot download unconfirmed tickets

---

## 🔧 Test Environment Setup

### Prerequisites
```bash
# Install Playwright
npm init playwright@latest

# Install dependencies
npm install
```

### Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
})
```

---

## 📝 Test Data Requirements

### Test Events
- Event ID: `evt-tedx-2026`
- Seat layout: 100 seats (10x10 grid)
- Ticket types: Early Bird, Standard, VIP

### Test Users
- Admin: `admin@tedx.com` / `admin123456`
- Customer 1: `test1@example.com`
- Customer 2: `test2@example.com`

---

## ⚡ Execution Strategy

### Local Development
```bash
# Run all tests
npm run test:e2e

# Run specific test
npm run test:e2e -- purchase-flow

# Debug mode
npm run test:e2e -- --debug

# UI mode (interactive)
npm run test:e2e -- --ui
```

### CI/CD Pipeline
- Run on every PR
- Run nightly for full regression
- Fail on critical test failures only

---

## 📊 Success Metrics

- ✅ 100% critical paths pass
- ✅ < 5% flaky test rate
- ✅ Test execution < 10 minutes
- ✅ No race conditions in seat locking

---

## 🐛 Known Issues & Workarounds

1. **Email delivery delay**: Wait 5s after confirmation
2. **Seat lock cleanup**: Run cleanup script before tests
3. **Database state**: Reset between test runs
