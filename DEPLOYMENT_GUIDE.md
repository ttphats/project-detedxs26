# 🚀 TEDx Deployment Guide - Ubuntu Server

## ⚠️ Mixed Content Error Fix

Khi deploy lên server Ubuntu với IP `222.255.180.85`, client gặp lỗi **Mixed Content** vì:
- Client (web-client) có thể chạy trên HTTPS
- Backend API chạy HTTP → Browser block requests

## 📋 Solutions

### ✅ Solution 1: Enable HTTPS for Backend (Recommended)

#### Step 1: Setup SSL trên Ubuntu Server

```bash
# SSH vào server
ssh user@222.255.180.85

# Navigate to backend folder
cd /path/to/project-detedxs26/backend

# Run SSL setup script
sudo bash setup-ssl.sh
```

Script sẽ tự động:
- ✅ Cài đặt Nginx (nếu chưa có)
- ✅ Tạo self-signed SSL certificate
- ✅ Config Nginx với HTTPS (port 443)
- ✅ Redirect HTTP → HTTPS
- ✅ Enable CORS headers

#### Step 2: Update Environment Variables

**web-client/.env.production**
```bash
NEXT_PUBLIC_API_URL=https://222.255.180.85/api
```

**web-admin/.env.production**
```bash
NEXT_PUBLIC_API_URL=https://222.255.180.85/api
```

#### Step 3: Rebuild & Redeploy

```bash
# Rebuild web-client
cd web-client
npm run build

# Rebuild web-admin
cd ../web-admin
npm run build

# Restart services (if using PM2)
pm2 restart all
```

---

### 🔧 Solution 2: Use Domain with Let's Encrypt (Production-Ready)

Nếu có domain (ví dụ: `api.tedx.com`):

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.tedx.com

# Auto-renew (Certbot tự config)
sudo certbot renew --dry-run
```

Update env:
```bash
NEXT_PUBLIC_API_URL=https://api.tedx.com/api
```

---

### ⚡ Solution 3: Temporary Fix (Development Only)

**KHÔNG khuyến khích cho production!**

Thêm meta tag vào `web-client/src/app/layout.tsx`:

```tsx
<meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
```

Hoặc chạy backend cũng trên HTTPS bằng self-signed cert trong code.

---

## 📝 Current Issue Analysis

### Error Messages:
```
Mixed Content: The page at '<URL>' was loaded over HTTPS, 
but requested an insecure resource 'http://222.255.180.85:4000/api/events/...'. 
This request has been blocked
```

### Root Cause:
- ❌ Client → Backend: HTTPS → HTTP (blocked)
- ✅ Client → Backend: HTTPS → HTTPS (allowed)
- ✅ Client → Backend: HTTP → HTTP (allowed)

---

## 🎯 Recommended Deployment Architecture

```
User Browser (HTTPS)
    ↓
Nginx (Port 443 - HTTPS)
    ↓
Backend Fastify (Port 4000 - HTTP localhost)
    ↓
MySQL Database
```

**Benefits:**
- ✅ SSL termination tại Nginx
- ✅ Backend chỉ listen localhost (secure)
- ✅ Nginx handle load balancing, caching, rate limiting
- ✅ Easy to scale

---

## 🔍 Verify Setup

### 1. Check Backend HTTPS:
```bash
curl -k https://222.255.180.85/health
# Expected: {"status":"ok"}
```

### 2. Check CORS:
```bash
curl -I -X OPTIONS https://222.255.180.85/api/events
# Expected: Access-Control-Allow-Origin: *
```

### 3. Test from Client:
```javascript
// Browser console
fetch('https://222.255.180.85/api/events')
  .then(r => r.json())
  .then(console.log)
```

---

## 🐛 Troubleshooting

### Port already in use:
```bash
sudo lsof -i :443
sudo kill -9 <PID>
```

### Nginx errors:
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Backend not accessible:
```bash
# Check if backend is running
pm2 list
# or
netstat -tlnp | grep :4000
```

### Self-signed certificate warning:
Browser sẽ hiển thị warning "Your connection is not private". 
User cần click "Advanced" → "Proceed to 222.255.180.85"

---

## 📚 Files Created:

- ✅ `backend/nginx-ssl.conf` - Nginx config with HTTPS
- ✅ `backend/setup-ssl.sh` - Auto SSL setup script
- ✅ `DEPLOYMENT_GUIDE.md` - This guide

---

## 🚀 Quick Deploy Commands

```bash
# 1. On Ubuntu server
cd /path/to/project-detedxs26/backend
sudo bash setup-ssl.sh

# 2. Update env files locally
echo "NEXT_PUBLIC_API_URL=https://222.255.180.85/api" > web-client/.env.production
echo "NEXT_PUBLIC_API_URL=https://222.255.180.85/api" > web-admin/.env.production

# 3. Rebuild
cd web-client && npm run build
cd ../web-admin && npm run build

# 4. Deploy (rsync or git pull on server)
rsync -avz --exclude node_modules . user@222.255.180.85:/path/to/project/

# 5. Restart on server
pm2 restart all
```

✅ Done!
