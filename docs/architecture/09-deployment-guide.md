# Deployment Guide

> **🎯 For:** DevOps, Deployment  
> **📅 Last Updated:** 2026-06-13  
> **🔗 Previous:** [Development Guide](./08-development-guide.md)

---

## 🌐 Production Architecture

```
┌─────────────────────────────────────────┐
│         Cloudflare / CDN                │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────┐      ┌────▼─────┐
│ Client │      │  Admin   │
│  :3000 │      │  :3002   │
└────────┘      └──────────┘
    │                 │
    └────────┬────────┘
             │
       ┌─────▼──────┐
       │  Backend   │
       │   :4000    │
       └─────┬──────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼─────┐     ┌────▼─────┐
│  MySQL  │     │  Redis   │
│  :3306  │     │  :6379   │
└─────────┘     └──────────┘
```

---

## 🔧 Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL="mysql://user:password@103.179.188.241:3306/tedx_ticketing"

# JWT
JWT_SECRET="change-this-in-production-use-long-random-string"

# Email (Resend)
RESEND_API_KEY="re_xxxxxxxxxx"
EMAIL_FROM="TEDx <noreply@tedxfptuhcm.com>"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Redis
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_PASSWORD=""  # Optional

# Payment Gateway
VNPAY_TMN_CODE="YOUR_TMN_CODE"
VNPAY_HASH_SECRET="YOUR_HASH_SECRET"
VNPAY_URL="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"

# Server
PORT=4000
NODE_ENV=production
```

### Admin (.env.local)

```bash
NEXT_PUBLIC_API_URL=https://api.tedxfptuhcm.com/api
```

### Client (.env.local)

```bash
NEXT_PUBLIC_API_URL=https://api.tedxfptuhcm.com/api
```

---

## 🚀 Deployment Steps

### 1. Backend Deployment (PM2)

```bash
# SSH to server
ssh user@103.179.188.241

# Navigate to project
cd /var/www/tedx-ticketing/backend

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Run migrations
npx prisma migrate deploy
npx prisma generate

# Build TypeScript
npm run build

# Restart PM2
pm2 restart backend

# Check logs
pm2 logs backend --lines 50
```

#### PM2 Ecosystem Config

```js
// backend/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'backend',
    script: './dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
```

### 2. Frontend Deployment (Vercel)

```bash
# Admin deployment
cd admin
vercel --prod

# Client deployment
cd client
vercel --prod
```

**Vercel Environment Variables:**
- Add `NEXT_PUBLIC_API_URL` in Vercel dashboard
- Auto-deploy on push to `main` branch

---

## 🗄️ Database Management

### Production Migrations

```bash
# ALWAYS backup before migration!
mysqldump -h 103.179.188.241 -u user -p tedx_ticketing > backup_$(date +%Y%m%d).sql

# Run migration
cd backend
npx prisma migrate deploy

# Verify
npx prisma studio
```

### Backup Strategy

```bash
# Daily backup cron (add to crontab)
0 2 * * * /usr/bin/mysqldump -h 103.179.188.241 -u user -p'password' tedx_ticketing | gzip > /backups/tedx_$(date +\%Y\%m\%d).sql.gz

# Keep last 7 days only
0 3 * * * find /backups -name "tedx_*.sql.gz" -mtime +7 -delete
```

---

## 🔴 Redis Setup

### Installation (Ubuntu)

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Configure persistence
sudo vim /etc/redis/redis.conf
# Set: appendonly yes

# Start service
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Test
redis-cli ping
# Should return: PONG
```

---

## 🔒 Security Checklist

### Before Production

- [ ] Change all default passwords
- [ ] Generate new JWT secret (256-bit random)
- [ ] Enable HTTPS (SSL certificates)
- [ ] Configure firewall (only allow necessary ports)
- [ ] Enable database SSL connections
- [ ] Set up fail2ban for SSH
- [ ] Configure rate limiting in production
- [ ] Review CORS allowed origins
- [ ] Enable audit logging
- [ ] Set up error monitoring (Sentry)

### SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d api.tedxfptuhcm.com

# Auto-renew
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet
```

---

## 📊 Monitoring

### Health Check Endpoint

```bash
# Add to backend
fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime()
}))

# Monitor with cron
*/5 * * * * curl https://api.tedxfptuhcm.com/health || echo "API DOWN" | mail -s "Alert" admin@example.com
```

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Memory usage
pm2 status

# Logs
pm2 logs --lines 100
```

---

## 🔄 Rollback Procedure

### If Deployment Fails

```bash
# 1. Revert code
git log  # Find previous commit hash
git reset --hard <previous-commit>
git push --force origin main

# 2. Rollback database
mysql -h 103.179.188.241 -u user -p tedx_ticketing < backup_20260613.sql

# 3. Restart services
pm2 restart backend
```

---

## 🚨 Emergency Procedures

### Backend Down

```bash
# Check PM2 status
pm2 status

# Restart
pm2 restart backend

# If still down, check logs
pm2 logs backend --err

# Check database connection
mysql -h 103.179.188.241 -u user -p
```

### Database Connection Issues

```bash
# Check MySQL service
sudo systemctl status mysql

# Check connections
mysql -e "SHOW PROCESSLIST;"

# Kill long-running queries
mysql -e "KILL <process_id>;"
```

### Redis Down

```bash
# Restart Redis
sudo systemctl restart redis-server

# Check status
redis-cli ping

# If corrupt, restore from AOF
redis-cli --rdb /var/lib/redis/dump.rdb
```

---

## 📈 Performance Optimization

### Database Indexing

```sql
-- Check slow queries
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- View slow queries
SELECT * FROM mysql.slow_log;

-- Add missing indexes
CREATE INDEX idx_custom ON table(column);
```

### Redis Optimization

```bash
# Increase maxmemory
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### PM2 Cluster Mode

```js
// Use all CPU cores
instances: 'max'
```

---

## 📞 Contact & Support

**Server:** 103.179.188.241  
**Database:** MySQL 8.0  
**Backend Port:** 4000  
**Admin Port:** 3002  
**Client Port:** 3000

---

**End of Documentation** ✅
