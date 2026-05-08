# Fix Email Ticket Links - Production Deployment

## Issue
Email ticket links were showing `http://localhost:3000/ticket/...` instead of `https://tedxfptuniversityhcmc.com/ticket/...`.

## Root Cause
Backend `.env.production` was missing `CLIENT_URL` environment variable, causing the email service to use the default localhost URL when generating ticket links.

---

## Fix Steps (On Ubuntu Server)

### 1. SSH to Server

```bash
ssh user@server-ip
```

### 2. Navigate to Backend Directory

```bash
cd /path/to/project-detedxs26/backend
```

### 3. Pull Latest Code

```bash
git pull origin main
```

### 4. Update `.env` File

Edit the `.env` file (or create `.env.production` and use it):

```bash
nano .env
```

**Add/Update these lines:**

```bash
# Client URL - IMPORTANT for email ticket links!
CLIENT_URL=https://tedxfptuniversityhcmc.com

# Email Provider
EMAIL_PROVIDER=resend
EMAIL_FROM=TEDxFPT University HCMC <onboarding@resend.dev>
RESEND_API_KEY=re_S7rTjxuw_25cPnF4cMJBHMMtUHg43jnxr

# CORS - Include all production domains
CORS_ORIGINS=https://api.tedxfptuniversityhcmc.com,https://tedxfptuniversityhcmc.com,https://www.tedxfptuniversityhcmc.com,https://admin.tedxfptuniversityhcmc.com
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### 5. Restart Backend

```bash
pm2 restart tedx-backend

# Or if not using PM2:
npm run build
npm start
```

### 6. Verify Configuration

```bash
# Check logs
pm2 logs tedx-backend

# Should see:
# ✅ CLIENT_URL: https://tedxfptuniversityhcmc.com
```

---

## Test Email Links

### Option 1: Admin Panel Test

1. Login to admin: https://admin.tedxfptuniversityhcmc.com/admin/login
2. Go to Orders page
3. Find a PENDING_CONFIRMATION order
4. Click "Xác nhận thanh toán"
5. Check email sent to customer
6. **Verify link:** Should be `https://tedxfptuniversityhcmc.com/ticket/...`

### Option 2: API Test (curl)

```bash
# Check config endpoint (if you have one)
curl https://api.tedxfptuniversityhcmc.com/api/health

# Or check backend logs when email is sent
pm2 logs tedx-backend | grep "CLIENT_URL"
```

---

## Environment Variables Reference

### Required for Email Links:

| Variable | Example | Description |
|----------|---------|-------------|
| `CLIENT_URL` | `https://tedxfptuniversityhcmc.com` | Frontend URL for ticket links |
| `EMAIL_PROVIDER` | `resend` | Email service provider |
| `RESEND_API_KEY` | `re_xxx` | Resend API key |
| `EMAIL_FROM` | `TEDx <onboarding@resend.dev>` | From email address |

### Related Variables:

| Variable | Example | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `https://tedxfpt...` | Allowed CORS origins |
| `FRONTEND_URL` | `https://tedxfpt...` | (Optional) Alias |
| `ADMIN_URL` | `https://admin.tedxfpt...` | (Optional) Admin panel URL |

---

## Troubleshooting

### Still Seeing Localhost in Emails?

**Check:**
1. `.env` file has `CLIENT_URL` set correctly
2. Backend was restarted after updating `.env`
3. Backend logs show correct CLIENT_URL on startup

```bash
# View current env
pm2 describe tedx-backend | grep CLIENT_URL

# Restart
pm2 restart tedx-backend
```

### Email Not Sending?

**Check Resend Setup:**
1. Domain verification: https://resend.com/domains
2. API key is valid
3. `EMAIL_PROVIDER=resend` (not `mock`)

```bash
# Check email logs in backend
pm2 logs tedx-backend | grep -i email
```

---

## Related Files Changed

- `backend/.env.production` - Added CLIENT_URL and email config
- `backend/.env.example` - Added documentation
- `backend/src/services/qrcode.service.ts` - Uses `config.clientUrl`
- `backend/src/config/env.ts` - Defines CLIENT_URL config

---

## Next Steps

After deployment:
1. ✅ Verify email links are correct
2. ✅ Test mobile checkout flow (previous fix)
3. ✅ Check database datetime issues (if any)
4. ⚠️ Update Resend domain verification (if using custom domain)

**Production Domains:**
- Frontend: `https://tedxfptuniversityhcmc.com`
- Admin: `https://admin.tedxfptuniversityhcmc.com`
- API: `https://api.tedxfptuniversityhcmc.com`
