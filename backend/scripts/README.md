# Test Scripts - TEDx Ticketing System

## 📝 test-flow.mjs

Script test toàn bộ luồng nghiệp vụ từ đầu đến cuối.

### Flow được test:

1. **Admin Login** - Đăng nhập admin
2. **Get Ticket Types** - Lấy danh sách loại vé
3. **Check Layout Versions** - Kiểm tra layout versions
4. **Get Available Seats** - Lấy danh sách ghế trống
5. **Select Seats** - Chọn 2 ghế
6. **Lock Seats** - Khóa ghế đã chọn
7. **Create Pending Order** - Tạo đơn hàng chờ thanh toán
8. **Client Confirm Payment** - Client xác nhận đã chuyển khoản
9. **Admin Get Pending Orders** - Admin xem danh sách đơn chờ xác nhận
10. **Admin Confirm Payment** - Admin xác nhận thanh toán → **GỬI EMAIL**
11. **Verify** - Kiểm tra email đã được gửi

### Usage:

```bash
cd backend
node scripts/test-flow.mjs
```

### Configuration:

Edit trong file `test-flow.mjs`:

```javascript
const BASE_URL = 'http://localhost:4000';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123456';
const TEST_EMAIL = 'skphat789@gmail.com';  // Email sẽ nhận vé
const EVENT_ID = 'evt-tedx-2026';
```

### Expected Output:

```
🚀 Starting Full Business Flow Test...

📝 Step 1: Admin Login
✅ Admin logged in successfully

📝 Step 2: Get ticket types for event
✅ Found 3 ticket types:
   - Early Bird: 800.000đ
   - Standard: 1.500.000đ
   - VIP: 2.500.000đ

📝 Step 3: Check layout versions
✅ Found 0 layout versions

📝 Step 4: Get available seats
✅ Found 100 available seats (total: 100)

📝 Step 5: Select seats:
   - A1 (STANDARD) - 1.500.000đ
   - A6 (STANDARD) - 1.500.000đ

📝 Step 5.5: Lock seats
✅ Locked 2 seats

📝 Step 6: Create pending order
✅ Order created: TKHT8QJQE
   Total: 3.000.000đ
   Expires: 2026-05-06T02:27:10.000Z

📝 Step 7: Client confirms payment
✅ Payment confirmed, status: PENDING_CONFIRMATION

📝 Step 8: Admin get pending orders
✅ Found 1 pending orders

📝 Step 9: Admin confirm order and send email
   Order ID: 9387c516-0b95-47c2-8a3d-d6421494ec91
   Order Number: TKHT8QJQE
   Customer: Nguyễn Test Flow <skphat789@gmail.com>
   Confirming...

✅ Admin confirmed payment!
   Status: PAID
   Email Status: SENT
   Email Sent To: skphat789@gmail.com
   Ticket URL: http://localhost:3000/ticket/TKHT8QJQE?token=xxx

🎉 SUCCESS! Email sent to: skphat789@gmail.com
📧 Check your inbox at skphat789@gmail.com

✅ Full flow completed successfully!
```

### Email Template Used:

Email được gửi qua Resend API với template "TICKET_CONFIRMED" từ database.

Email bao gồm:
- ✅ Order Number
- ✅ Customer Name
- ✅ Event Details (name, date, time, venue)
- ✅ Seat Information
- ✅ Total Amount
- ✅ QR Code for check-in
- ✅ Ticket URL to view online

### Troubleshooting:

**No available seats:**
```bash
# Check database
node -e "const {PrismaClient} = require('@prisma/client'); const prisma = new PrismaClient(); prisma.seat.count({where: {eventId: 'evt-tedx-2026', status: 'AVAILABLE'}}).then(console.log);"
```

**Email not sent:**
- Check `.env` file has valid `RESEND_API_KEY`
- Check email template "TICKET_CONFIRMED" exists in database
- Check backend logs for email errors

**Admin login failed:**
- Default admin: username=`admin`, password=`admin123456`
- Check database `users` table

### Prerequisites:

- ✅ Backend server running on port 4000
- ✅ Database connection working
- ✅ Resend API key configured in `.env`
- ✅ Admin user exists in database
- ✅ Event `evt-tedx-2026` exists and has seats
- ✅ Email template "TICKET_CONFIRMED" exists in database

---

## Other Scripts:

- `fix-invalid-dates.mjs` - Fix invalid datetime values in database
- `seed-email-templates.mjs` - Seed email templates to database
