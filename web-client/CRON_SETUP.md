# Cron Job Setup - Auto Expire Orders

## Overview

Tự động expire các order PENDING sau 15 phút và unlock ghế.

## Cron Job Endpoint

**URL**: `/api/cron/expire-orders`  
**Method**: `GET`  
**Schedule**: Mỗi phút (every minute)  
**Authentication**: Bearer token với `CRON_SECRET`

## Setup

### 1. Vercel Cron (Recommended for Production)

File `vercel.json` đã được tạo với config:

```json
{
  "crons": [
    {
      "path": "/api/cron/expire-orders",
      "schedule": "* * * * *"
    }
  ]
}
```

**Environment Variable cần thiết**:
```
CRON_SECRET=your-secret-key-here
```

Vercel sẽ tự động gọi endpoint này mỗi phút với header:
```
Authorization: Bearer <CRON_SECRET>
```

### 2. Local Development

Để test local, dùng curl:

```bash
curl -H "Authorization: Bearer dev-secret-change-in-production" \
  http://localhost:3000/api/cron/expire-orders
```

Hoặc setup cron job trên máy local (Linux/Mac):

```bash
# Edit crontab
crontab -e

# Add this line (chạy mỗi phút)
* * * * * curl -H "Authorization: Bearer dev-secret-change-in-production" http://localhost:3000/api/cron/expire-orders
```

### 3. Alternative: GitHub Actions

Tạo file `.github/workflows/expire-orders.yml`:

```yaml
name: Expire Orders Cron

on:
  schedule:
    - cron: '* * * * *'  # Every minute
  workflow_dispatch:  # Manual trigger

jobs:
  expire-orders:
    runs-on: ubuntu-latest
    steps:
      - name: Call expire orders API
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/cron/expire-orders
```

## What the Cron Job Does

1. **Tìm expired orders**: Query tất cả orders với `status = 'PENDING'` và `expires_at < NOW()`
2. **Update order status**: Set `status = 'EXPIRED'`
3. **Update payment status**: Set payment `status = 'FAILED'`
4. **Release seats**: Set seats `status = 'AVAILABLE'`
5. **Delete locks**: Xóa seat_locks nếu còn tồn tại

## Response Format

```json
{
  "success": true,
  "data": {
    "totalFound": 5,
    "successCount": 5,
    "errorCount": 0,
    "message": "Expired 5 orders, 0 errors"
  }
}
```

## Monitoring

Check logs để xem cron job hoạt động:

```bash
# Vercel logs
vercel logs

# Local logs
# Xem terminal output
```

Expected log output:
```
[EXPIRE ORDERS] Found 3 expired orders
[EXPIRE ORDERS] Expired order TKH123456, released 2 seats
[EXPIRE ORDERS] Expired order TKH789012, released 1 seats
[EXPIRE ORDERS] Expired order TKH345678, released 3 seats
```

## Security

- **CRON_SECRET**: Đổi giá trị mặc định `dev-secret-change-in-production` trong production
- **Rate limiting**: Vercel Cron tự động handle, không cần lo
- **Idempotent**: Cron job có thể chạy nhiều lần mà không gây lỗi

## Testing

Test manually:

```bash
# 1. Tạo order PENDING
curl -X POST http://localhost:3000/api/orders/create-pending \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-tedx-2026",
    "seatIds": ["seat-id-1"],
    "sessionId": "test-session"
  }'

# 2. Đợi 15 phút hoặc update expires_at trong DB
UPDATE orders SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE order_number = 'TKH123456';

# 3. Chạy cron job
curl -H "Authorization: Bearer dev-secret-change-in-production" \
  http://localhost:3000/api/cron/expire-orders

# 4. Kiểm tra order đã expired
curl http://localhost:3000/api/orders/TKH123456?token=xxx
```

## Troubleshooting

**Cron không chạy**:
- Check `CRON_SECRET` environment variable
- Check Vercel deployment logs
- Verify `vercel.json` syntax

**Orders không expire**:
- Check database `expires_at` column
- Check timezone settings
- Check cron job logs

**Seats không unlock**:
- Check seat status in database
- Check seat_locks table
- Check transaction rollback logs

