# ☁️ Cloudflare Tunnel Setup Guide

## ✅ Current Configuration

**Backend Domain:** `https://api.tedxfptuniversityhcmc.com`  
**Backend Port:** `4000` (localhost)  
**Status:** ✅ Already configured

---

## 🔍 Verify Cloudflare Tunnel

### On Ubuntu Server:

```bash
# Check cloudflared service status
sudo systemctl status cloudflared

# Check tunnel configuration
cat /etc/cloudflared/config.yml
# or
cat ~/.cloudflared/config.yml
```

**Expected config.yml:**
```yaml
tunnel: <your-tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.tedxfptuniversityhcmc.com
    service: http://localhost:4000
  - service: http_status:404
```

---

## 🧪 Test Backend via Cloudflare Tunnel

### 1. Health Check:
```bash
curl https://api.tedxfptuniversityhcmc.com/health
```
**Expected:** `{"status":"ok"}`

### 2. API Test:
```bash
curl https://api.tedxfptuniversityhcmc.com/api/events
```
**Expected:** JSON response with events list

### 3. From Browser Console (F12):
```javascript
fetch('https://api.tedxfptuniversityhcmc.com/api/events')
  .then(r => r.json())
  .then(console.log)
```

---

## 🔄 Restart Tunnel (If needed)

```bash
# Restart cloudflared service
sudo systemctl restart cloudflared

# Check logs
sudo journalctl -u cloudflared -f
```

---

## 📝 Environment Variables Summary

### **web-client/.env**
```bash
NEXT_PUBLIC_API_URL=https://api.tedxfptuniversityhcmc.com/api
```

### **web-admin/.env**
```bash
NEXT_PUBLIC_API_URL=https://api.tedxfptuniversityhcmc.com/api
```

### **backend/.env**
```bash
PORT=4000
HOST=127.0.0.1  # Only listen on localhost (Cloudflare Tunnel will proxy)
```

---

## ✅ Benefits of Cloudflare Tunnel

1. **Automatic HTTPS** - No SSL certificate management
2. **DDoS Protection** - Cloudflare's enterprise-grade protection
3. **Global CDN** - Fast access worldwide
4. **No Firewall Changes** - No need to open ports
5. **Zero Trust Access** - Can add authentication layer
6. **Free** - For most use cases

---

## 🐛 Troubleshooting

### Backend not accessible via tunnel:

**1. Check Backend is running:**
```bash
netstat -tlnp | grep :4000
# or
curl http://localhost:4000/health
```

**2. Check Cloudflared service:**
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50
```

**3. Check DNS:**
```bash
nslookup api.tedxfptuniversityhcmc.com
# Should point to Cloudflare IPs
```

**4. Restart both services:**
```bash
# Restart backend
pm2 restart backend

# Restart tunnel
sudo systemctl restart cloudflared
```

---

## 🔐 Security Best Practices

### Backend should only listen on localhost:

**backend/.env:**
```bash
# Only accept connections from localhost
HOST=127.0.0.1
PORT=4000
```

**Why?**
- Backend không exposed trực tiếp ra internet
- Chỉ Cloudflare Tunnel có thể access
- Tăng bảo mật

### Firewall Rules:
```bash
# Block direct access to port 4000 from internet
sudo ufw deny 4000/tcp

# Only allow localhost
sudo ufw allow from 127.0.0.1 to any port 4000
```

---

## 📚 Additional Resources

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)

---

## ✅ Verification Checklist

- [✅] Cloudflare Tunnel running
- [✅] Backend listening on localhost:4000
- [✅] DNS pointing to Cloudflare
- [✅] HTTPS working: https://api.tedxfptuniversityhcmc.com/health
- [✅] Client env updated: NEXT_PUBLIC_API_URL
- [✅] No Mixed Content errors
- [✅] API requests successful

🎉 All set!
