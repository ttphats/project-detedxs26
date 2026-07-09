# Test Cases - TEDx Ticketing System

## 🎯 Test Coverage Summary

| ID | Feature | Priority | Test Cases | Status |
|----|---------|----------|------------|--------|
| TC-01 | Seat Selection | CRITICAL | 8 | ⏳ TODO |
| TC-02 | Checkout Flow | CRITICAL | 6 | ⏳ TODO |
| TC-03 | Payment Confirmation | CRITICAL | 7 | ⏳ TODO |
| TC-04 | Ticket Download | HIGH | 5 | ⏳ TODO |
| TC-05 | Lock Expiration | HIGH | 4 | ⏳ TODO |
| TC-06 | Race Conditions | CRITICAL | 3 | ⏳ TODO |

---

## 📋 TC-01: Seat Selection Tests

### TC-01-01: Select Single Available Seat ✅
**Priority:** CRITICAL  
**Pre-condition:** User is on event seat selection page with available seats

**Steps:**
1. Navigate to `/events/evt-tedx-2026/seats`
2. Wait for seat map to load
3. Click on an available seat (green)
4. Verify seat changes to selected (yellow/highlighted)
5. Verify selected seats counter increases to 1
6. Verify total price updates
7. Verify checkout button becomes enabled

**Expected Result:**
- Seat status: `available` → `selected`
- Selected seats array contains 1 seat
- Lock timer starts (10 minutes countdown)
- API call: `POST /api/seats/lock` returns `success: true`

---

### TC-01-02: Select Multiple Seats (Max 4) ✅
**Priority:** CRITICAL

**Steps:**
1. Select 1st available seat → Success
2. Select 2nd available seat → Success
3. Select 3rd available seat → Success
4. Select 4th available seat → Success
5. Try to select 5th seat → Should be blocked

**Expected Result:**
- Maximum 4 seats can be selected
- Error message: "Bạn chỉ có thể chọn tối đa 4 ghế"
- 5th seat remains unselected

---

### TC-01-03: Deselect Seat ✅
**Priority:** HIGH

**Steps:**
1. Select a seat (becomes yellow)
2. Click the same seat again
3. Verify seat deselected (back to green)

**Expected Result:**
- API call: `DELETE /api/seats/lock`
- Seat status: `selected` → `available`
- Selected seats count decreases

---

### TC-01-04: Cannot Select Sold Seat ❌
**Priority:** CRITICAL

**Steps:**
1. Try to click a sold seat (gray/disabled)
2. Verify no selection occurs
3. Verify no API call made

**Expected Result:**
- Seat remains sold
- Cursor shows `not-allowed`
- No API interaction

---

### TC-01-05: Cannot Select Locked Seat (By Another User) ❌
**Priority:** CRITICAL

**Steps:**
1. User A locks seat S1
2. User B tries to click seat S1
3. Verify User B cannot select

**Expected Result:**
- Seat status for User B: `locked` (red/orange)
- Click does nothing
- Error toast: "Ghế này đang được giữ bởi người khác"

---

### TC-01-06: Can Select Own Locked Seat ✅
**Priority:** HIGH

**Steps:**
1. User navigates away from seat page
2. User returns with same sessionId
3. Previously locked seats show as `locked_by_me`
4. User can click to deselect

**Expected Result:**
- Seats previously locked by sessionId show special color
- Can deselect these seats

---

### TC-01-07: Lock Timer Countdown ✅
**Priority:** HIGH

**Steps:**
1. Select a seat
2. Observe countdown timer display
3. Verify timer counts down from 10:00

**Expected Result:**
- Timer shows "10:00" initially
- Updates every second
- Format: "MM:SS"

---

### TC-01-08: Price Calculation ✅
**Priority:** CRITICAL

**Steps:**
1. Select VIP seat (2,500,000đ)
2. Select Standard seat (1,500,000đ)
3. Verify total = 4,000,000đ

**Expected Result:**
- Total price = sum of selected seats
- Display format: "4.000.000đ"

---

## 📋 TC-02: Checkout Flow Tests

### TC-02-01: Create Pending Order ✅
**Priority:** CRITICAL

**Steps:**
1. Select 2 seats
2. Click "Thanh toán" button
3. Wait for redirect to checkout page

**Expected Result:**
- API call: `POST /api/orders/create-pending`
- Response includes: `orderNumber`, `accessToken`
- Redirect to: `/checkout?event=...&order=TKH-...&token=...`
- Order status: `PENDING`

---

### TC-02-02: Lock Extended to 15 Minutes ✅
**Priority:** HIGH

**Steps:**
1. Select seats (10 min lock)
2. Click checkout
3. Verify lock extended to 15 minutes

**Expected Result:**
- API call: `POST /api/seats/extend-lock`
- Timer resets to 15:00
- `expiresAt` updated in database

---

### TC-02-03: Checkout with Empty Selection ❌
**Priority:** HIGH

**Steps:**
1. Click "Thanh toán" with 0 seats selected
2. Verify button is disabled

**Expected Result:**
- Button disabled when `selectedSeats.length === 0`
- No API call made

---

### TC-02-04: Fill Customer Information ✅
**Priority:** CRITICAL

**Steps:**
1. On checkout page, fill form:
   - Name: "Nguyễn Văn A"
   - Email: "test@example.com"
   - Phone: "0901234567"
2. Click "Tôi đã chuyển khoản"

**Expected Result:**
- All fields required
- Email validation works
- Phone format validation

---

### TC-02-05: Confirm Payment (Customer Side) ✅
**Priority:** CRITICAL

**Steps:**
1. Fill customer info
2. Click "Tôi đã chuyển khoản"
3. Verify redirect to ticket status page

**Expected Result:**
- API call: `POST /api/orders/confirm-payment`
- Order status: `PENDING` → `PAID` (client-side)
- Redirect to: `/ticket/TKH-...?token=...`
- Shows "Đang chờ xác nhận từ admin"

---

### TC-02-06: Checkout Timeout ❌
**Priority:** HIGH

**Steps:**
1. On checkout page, wait 15 minutes
2. Lock expires
3. Try to submit payment

**Expected Result:**
- Error: "Đơn hàng đã hết hạn"
- Cannot submit payment
- Seats released

---

## 📋 TC-03: Payment Confirmation (Admin) Tests

### TC-03-01: Admin Confirms Payment ✅
**Priority:** CRITICAL

**Pre-condition:** Admin logged in, order exists with status PENDING

**Steps:**
1. Admin views pending orders list
2. Click "Xác nhận thanh toán" on order TKH-001
3. Verify email sent automatically

**Expected Result:**
- API: `POST /api/admin/orders/:id/confirm`
- Order status: `PENDING` → `PAID`
- Payment status: `PENDING` → `COMPLETED`
- Seat status: `LOCKED` → `SOLD`
- Email sent to customer with QR code
- `email_sent_at` timestamp recorded

---

### TC-03-02: Admin Rejects Payment ❌
**Priority:** HIGH

**Steps:**
1. Admin clicks "Từ chối"
2. Enter rejection reason
3. Submit

**Expected Result:**
- Order status: `PENDING` → `CANCELLED`
- Payment status: `PENDING` → `FAILED`
- Seats released: `LOCKED` → `AVAILABLE`
- NO email sent

---

### TC-03-03: Resend Email ✅
**Priority:** MEDIUM

**Steps:**
1. Admin views confirmed order
2. Click "Gửi lại email"

**Expected Result:**
- API: `POST /api/admin/orders/:id/resend-email`
- Email re-sent with same QR codes
- Toast: "Đã gửi lại email thành công"

---

### TC-03-04: Cannot Confirm Already Confirmed ❌
**Priority:** HIGH

**Steps:**
1. Order already has status `PAID`
2. Admin tries to confirm again

**Expected Result:**
- Button disabled or hidden
- If API called: Error "Order already confirmed"

---

### TC-03-05: Cannot Reject Already Confirmed ❌
**Priority:** HIGH

**Steps:**
1. Order status: `PAID`
2. Try to reject

**Expected Result:**
- Cannot reject confirmed orders
- Error message shown

---

### TC-03-06: Confirm with Transaction ID ✅
**Priority:** MEDIUM

**Steps:**
1. Enter transaction ID: "VCB-123456789"
2. Confirm payment

**Expected Result:**
- Transaction ID saved in payment record
- Visible in order details

---

### TC-03-07: Email Contains QR Code ✅
**Priority:** CRITICAL

**Steps:**
1. Confirm payment
2. Check email received

**Expected Result:**
- Email contains:
  - Order number
  - Event details
  - Seat numbers
  - QR code for each ticket
  - PDF attachment link

---

## 📋 TC-04: Ticket Download Tests

### TC-04-01: Download PDF from Email Link ✅
**Priority:** HIGH

**Steps:**
1. Open email link: `/ticket/TKH-001?token=...`
2. Click "Tải vé PDF"
3. Verify PDF downloads

**Expected Result:**
- API: `GET /api/ticket/:orderNumber/pdf?token=...`
- File downloads: `ticket-TKH-001.pdf`
- Toast: "Đã tải vé thành công!"

---

### TC-04-02: View Ticket Without Token ❌
**Priority:** HIGH

**Steps:**
1. Navigate to `/ticket/TKH-001` (no token)
2. Verify access denied

**Expected Result:**
- Error: "Access token required"
- Status: 401 Unauthorized

---

### TC-04-03: Download with Invalid Token ❌
**Priority:** HIGH

**Steps:**
1. Use wrong token: `/ticket/TKH-001?token=invalid`
2. Try to download

**Expected Result:**
- Error: "Invalid or expired token"
- Status: 401

---

### TC-04-04: PDF Contains Correct QR Code ✅
**Priority:** CRITICAL

**Steps:**
1. Download PDF
2. Extract QR code
3. Scan QR code

**Expected Result:**
- QR contains: `orderNumber`, `seatNumber`, `eventId`
- Scannable by standard QR readers

---

### TC-04-05: Multiple Downloads Allowed ✅
**Priority:** MEDIUM

**Steps:**
1. Download PDF
2. Download again

**Expected Result:**
- Can download multiple times
- Same file generated each time

---

## 📋 TC-05: Lock Expiration Tests

### TC-05-01: Lock Expires After 10 Minutes ✅
**Priority:** HIGH

**Steps:**
1. Select seat, wait 10 minutes
2. Verify seat auto-released

**Expected Result:**
- Timer reaches 00:00
- Seat auto-deselected
- Seat status: `locked_by_me` → `available`
- Can be selected by others

---

### TC-05-02: Order Expires After 15 Minutes ✅
**Priority:** HIGH

**Steps:**
1. Create pending order
2. Wait 15 minutes without payment

**Expected Result:**
- Order status: `PENDING` → `EXPIRED`
- Seats: `LOCKED` → `AVAILABLE`
- Cannot submit payment

---

### TC-05-03: Cron Job Cleanup ✅
**Priority:** MEDIUM

**Steps:**
1. Run cron: `/api/cron/cleanup-expired-locks`
2. Verify expired locks cleaned

**Expected Result:**
- All locks older than expiresAt are deleted
- Seats become available

---

## 📋 TC-06: Race Condition Tests

### TC-06-01: Two Users Select Same Seat ❌
**Priority:** CRITICAL

**Steps:**
1. User A and User B both click seat S1 simultaneously
2. Only one should succeed

**Expected Result:**
- User A: Seat locked successfully
- User B: Error "Ghế đã được chọn bởi người khác"
- Database has only 1 lock record for S1

---

### TC-06-02: Concurrent Checkout ❌
**Priority:** HIGH

**Steps:**
1. User A selects seats 1-4
2. User B tries to select seat 2 (already locked)
3. Verify User B blocked

**Expected Result:**
- User B cannot select seat 2
- Lock belongs to User A's sessionId

---

### TC-06-03: Lock Expiration Race ✅
**Priority:** MEDIUM

**Steps:**
1. User A's lock about to expire (10:01)
2. User B clicks same seat at 9:59
3. At 10:00, lock expires
4. User B's request processed

**Expected Result:**
- User B successfully gets the seat
- Old lock cleaned up
- New lock created

---

## ✅ Test Execution Checklist

- [ ] All CRITICAL tests pass
- [ ] All HIGH priority tests pass
- [ ] Email delivery verified
- [ ] QR codes scannable
- [ ] No race conditions
- [ ] Timeouts working correctly
- [ ] Admin flow complete
- [ ] Customer flow complete
