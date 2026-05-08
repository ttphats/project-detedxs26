# ⚡ Quick Fix: Mixed Content Error

## 🔴 Problem
```
Mixed Content: The page was loaded over HTTPS, but requested an insecure resource 
'http://222.255.180.85:4000/api/events/...'
```

Client không thể gọi HTTP API từ HTTPS page → Browser block request.

---

## ✅ Quick Solution (5 phút)

### Bước 1: SSH vào Ubuntu Server
```bash
ssh user@222.255.180.85
cd /path/to/project-detedxs26/backend
```

### Bước 2: Chạy SSL Setup Script
```bash
# Chạy script tự động setup SSL
sudo bash setup-ssl.sh
```

Script sẽ:
- Cài Nginx (nếu chưa có)
- Tạo SSL certificate
- Config Nginx redirect HTTP → HTTPS
- Restart Nginx

### Bước 3: Update Env Files (Trên máy local)

**web-client/.env.production**
```bash
NEXT_PUBLIC_API_URL=https://222.255.180.85/api
```

**web-admin/.env.production**
```bash
NEXT_PUBLIC_API_URL=https://222.255.180.85/api
```

### Bước 4: Rebuild & Deploy
```bash
# Build web-client
cd web-client
npm run build

# Build web-admin  
cd ../web-admin
npm run build

# Deploy to server (git pull or rsync)
git push origin main

# On server
ssh user@222.255.180.85
cd /path/to/project-detedxs26
git pull origin main

# Restart services
pm2 restart all
```

---

## 🧪 Test

### 1. Check Backend HTTPS:
```bash
curl -k https://222.255.180.85/health
```
Kết quả: `{"status":"ok"}`

### 2. Test API from Browser:
Mở browser console (F12):
```javascript
fetch('https://222.255.180.85/api/events')
  .then(r => r.json())
  .then(console.log)
```

### 3. Accept Self-Signed Certificate:
- Truy cập: https://222.255.180.85
- Browser hiện warning "Not secure"
- Click "Advanced" → "Proceed to 222.255.180.85"
- Sau đó client app sẽ hoạt động bình thường

---

## 📋 Verification Checklist

- [ ] Nginx chạy và listen port 443
- [ ] Backend Fastify chạy port 4000 (localhost)
- [ ] HTTP redirect to HTTPS
- [ ] CORS headers enabled
- [ ] Client env có HTTPS URL
- [ ] Browser accept certificate
- [ ] API requests thành công

---

## 🆘 Nếu vẫn lỗi:

### Check Nginx Status:
```bash
sudo systemctl status nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Check Backend:
```bash
pm2 list
pm2 logs backend
netstat -tlnp | grep :4000
```

### Check Firewall:
```bash
sudo ufw status
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
```

---

## 📞 Need Help?

Xem chi tiết tại: `DEPLOYMENT_GUIDE.md`
