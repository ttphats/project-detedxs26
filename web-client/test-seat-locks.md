# Test Seat Locks Feature

## Bước 1: Tạo table seat_locks

Có 2 cách:

### Cách 1: Dùng API (Khuyến nghị)
1. Start server: `npm run dev`
2. Gọi API: `curl -X POST http://localhost:3000/api/debug/seat-locks`

### Cách 2: Chạy SQL trực tiếp
```sql
CREATE TABLE IF NOT EXISTS seat_locks (
  id VARCHAR(36) PRIMARY KEY,
  seat_id VARCHAR(36) UNIQUE NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  ticket_type_id VARCHAR(36) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_id (event_id),
  INDEX idx_session_id (session_id),
  INDEX idx_expires_at (expires_at)
);
```

## Bước 2: Kiểm tra table đã được tạo

```bash
curl http://localhost:3000/api/debug/seat-locks
```

## Bước 3: Test tính năng lock

1. Mở browser 1 (Chrome): `http://localhost:3000/events/evt-tedx-2026/seats`
2. Mở browser 2 (Edge/Firefox): `http://localhost:3000/events/evt-tedx-2026/seats`
3. Chọn ghế ở browser 1 (ví dụ: B5)
4. Đợi 2 giây (polling interval)
5. Kiểm tra browser 2: Ghế B5 phải hiển thị màu **xám** (locked)

## Bước 4: Kiểm tra console logs

### Browser 1 (đã chọn ghế):
- Console: `[Polling] Locked seats: [{id: "...", seatNumber: "B5", status: "locked_by_me"}]`

### Browser 2 (chưa chọn ghế):
- Console: `[Polling] Locked seats: [{id: "...", seatNumber: "B5", status: "locked"}]`

### Server logs:
```
[LOCK] Locked 1 seats for session session_1234567... { seatNumbers: ['B5'], expiresAt: '2026-01-30T...' }
[GET SEATS] Event evt-tedx-2026, Session session_1234567..., Locked seats: 1, Total locks in DB: 1
```

## Bước 5: Debug nếu không work

### Kiểm tra API response
```bash
# Lấy danh sách ghế với locks
curl "http://localhost:3000/api/events/evt-tedx-2026/seats?sessionId=test123"
```

### Kiểm tra locks trong database
```bash
curl http://localhost:3000/api/debug/seat-locks
```

### Clear expired locks
```bash
curl -X DELETE http://localhost:3000/api/debug/seat-locks
```

## Màu sắc ghế

- **Xanh lá**: Available (có thể chọn)
- **Xanh dương/Đỏ**: Selected (đã chọn bởi bạn)
- **Xám**: Locked (đang được giữ bởi người khác)
- **Đỏ đậm**: Sold (đã bán)

## Lưu ý

- Lock timeout: **10 phút**
- Polling interval: **2 giây**
- Max seats per lock: **10 ghế**

