# TEDxFPTUniversityHCMC 2026 - Luồng Nghiệp Vụ

## 1. Tổng Quan Hệ Thống

### Thành phần
- **web-client** (port 3000): Trang public cho khách hàng xem event và đặt vé
- **web-admin** (port 3002): Trang admin quản lý events, orders, seats, speakers
- **MySQL Database**: Remote database tại 202.92.4.66
- **Cloudinary**: Lưu trữ ảnh (folder: `tedx-fptuhcmc`)

---

## 2. Quản Lý Events (Admin)

### 2.1 Tạo Event Mới
1. Admin vào `/admin/events` → Click "Thêm sự kiện"
2. Điền thông tin: tên, địa điểm, ngày, giờ, mô tả
3. Upload ảnh banner (1920x1080) và thumbnail (800x600) → Cloudinary
4. Event được tạo với status `DRAFT`

### 2.2 Publish Event
1. Admin click toggle "Publish" → Status chuyển thành `PUBLISHED`
2. Event hiển thị trên trang client

### 2.3 Event Status
- `DRAFT`: Mới tạo, chưa public
- `PUBLISHED`: Đang mở bán vé
- `CANCELLED`: Đã hủy
- `COMPLETED`: Đã kết thúc

---

## 3. Quản Lý Layout & Seats (Admin)

### 3.1 Nguyên tắc
- Admin **KHÔNG** edit seats trực tiếp, chỉ edit **SECTIONS**
- Seats được **GENERATE** từ sections
- Layouts có **VERSIONING**: DRAFT → PUBLIC → ARCHIVED
- Chỉ có **1 layout PUBLIC** tại một thời điểm
- Seats đã **BOOKED/HOLD** là **IMMUTABLE** (không thể thay đổi)

### 3.2 Tạo Layout
1. Admin vào `/admin/events/[id]/layout`
2. Thêm sections (LEFT, CENTER, RIGHT)
3. Cấu hình: số hàng, số cột, loại ghế, giá
4. Click "Generate Seats" → Hệ thống tạo seats từ sections
5. Save → Layout ở trạng thái DRAFT

### 3.3 Publish Layout
1. Admin click "Publish Layout"
2. Layout DRAFT → PUBLIC
3. Layout PUBLIC cũ → ARCHIVED
4. Seats mới được tạo, seats BOOKED được preserve

### 3.4 Seat Identity
- `seatKey = sectionCode + row + col` (ví dụ: `L-A-1`, `C-B-5`)
- Đảm bảo stable identity khi layout thay đổi

---

## 4. Quản Lý Speakers (Admin)

### 4.1 Thêm Speaker
1. Admin vào `/admin/speakers`
2. Chọn event → Click "Thêm speaker"
3. Điền: tên, chức danh, công ty, bio, topic
4. Upload ảnh (400x400) → Cloudinary folder `tedx-fptuhcmc/speakers`

### 4.2 Hiển thị
- Speakers active hiển thị trên trang client
- Có thể toggle ẩn/hiện speaker

---

## 5. Quản Lý Ticket Types (Admin)

### 5.1 Loại vé
- **VIP**: Ghế hàng đầu, gặp gỡ speakers, dinner
- **STANDARD**: Ghế thường, tất cả talks, lunch
- **ECONOMY**: Ghế sau, basic access

### 5.2 Cấu hình
- Tên, giá, mô tả, benefits
- Màu sắc, icon hiển thị
- Số lượng tối đa

---

## 6. Luồng Đặt Vé (Client)

### 6.1 Xem Event
1. Khách vào trang chủ → Xem featured event
2. Click "Get Tickets" → Chuyển đến `/events/[id]/seats`

### 6.2 Chọn Ghế
1. Xem sơ đồ ghế (seat map)
2. Click chọn ghế available
3. Ghế chuyển sang trạng thái LOCKED (tạm giữ)

### 6.3 Thanh Toán
1. Điền thông tin: họ tên, email, phone
2. Chọn phương thức thanh toán
3. Xác nhận đặt vé

### 6.4 Xác Nhận
1. Ghế chuyển sang BOOKED
2. Gửi email xác nhận (via Resend/SendGrid)
3. Hiển thị mã đặt vé

---

## 7. Email System

### 7.1 Providers
```env
EMAIL_PROVIDER="mock"     # Development - log to console
EMAIL_PROVIDER="resend"   # Production - Resend API
EMAIL_PROVIDER="sendgrid" # Alternative - SendGrid API
```

### 7.2 Email Templates
- Xác nhận đặt vé
- Nhắc nhở sự kiện
- Hủy vé

---

## 8. Cloudinary Structure

```
tedx-fptuhcmc/
├── events/
│   ├── {event-id}-banner.jpg      # 1920x1080
│   └── {event-id}-thumbnail.jpg   # 800x600
└── speakers/
    └── {speaker-id}.jpg           # 400x400, face crop
```

---

## 9. Database Schema (Key Tables)

- `events`: Thông tin sự kiện
- `seats`: Ghế ngồi (linked to event)
- `ticket_types`: Loại vé và giá
- `speakers`: Diễn giả
- `orders`: Đơn đặt vé
- `order_items`: Chi tiết ghế trong đơn
- `layout_versions`: Phiên bản layout
- `sections`: Khu vực ghế trong layout

---

## 10. API Endpoints

### Public (web-client)
- `GET /api/events` - List published events
- `GET /api/events?featured=true` - Featured event
- `GET /api/events/[id]` - Event details với seats
- `GET /api/events/[id]/speakers` - Speakers của event

### Admin (web-admin)
- `CRUD /api/admin/events` - Quản lý events
- `CRUD /api/admin/speakers` - Quản lý speakers
- `CRUD /api/admin/ticket-types` - Quản lý loại vé
- `POST /api/admin/upload` - Upload ảnh lên Cloudinary

