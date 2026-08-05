# Quick Email Setup - 5 Phút Đổi Email Riêng

## 🚀 TL;DR - Setup trong 5 phút

### Bước 1: Add Domain (1 phút)

1. Vào: https://resend.com/domains
2. Click **"Add Domain"**
3. Nhập: `tedxfptuhcm.com` (hoặc domain của bạn)
4. Click **"Add"**

### Bước 2: Copy DNS Records (1 phút)

Resend sẽ hiển thị 5 records. Copy từng cái.

### Bước 3: Add vào Cloudflare/DNS Provider (2 phút)

**Cloudflare:**
1. Vào: https://dash.cloudflare.com
2. Chọn domain
3. Click **DNS** tab
4. Click **"Add record"** 5 lần
5. Paste 5 records từ Resend

**Namecheap:**
1. Vào: https://ap.www.namecheap.com
2. Click **Manage** → **Advanced DNS**
3. Click **"Add New Record"** 5 lần
4. Paste 5 records từ Resend

### Bước 4: Verify (30 giây)

1. Đợi 5-10 phút
2. Quay lại Resend
3. Click **"Verify"**
4. Thấy ✅ **Verified** → Done!

### Bước 5: Update Code (30 giây)

Edit `backend/.env`:

```env
EMAIL_FROM="TEDx Events <events@tedxfptuhcm.com>"
```

### Bước 6: Test (30 giây)

```bash
cd backend
node scripts/test-flow.mjs
```

Check inbox → Email từ `events@tedxfptuhcm.com`! 🎉

---

## 📋 DNS Records Cần Add

| Type | Name | Value |
|------|------|-------|
| TXT | @ | `v=spf1 include:_spf.resend.com ~all` |
| TXT | resend._domainkey | `[Resend sẽ cung cấp]` |
| TXT | resend2._domainkey | `[Resend sẽ cung cấp]` |
| TXT | resend3._domainkey | `[Resend sẽ cung cấp]` |
| TXT | _dmarc | `v=DMARC1; p=none;` |

---

## ✅ Checklist

- [ ] Add domain vào Resend
- [ ] Copy 5 DNS records
- [ ] Add vào DNS provider (Cloudflare/Namecheap/etc)
- [ ] Đợi 10 phút
- [ ] Verify domain trên Resend
- [ ] Update `EMAIL_FROM` trong `.env`
- [ ] Test với `node scripts/test-flow.mjs`
- [ ] Check inbox nhận email từ domain riêng

---

## ⚠️ Common Issues

**"DNS records not found":**
- Đợi thêm 30-60 phút
- Check DNS propagation: https://dnschecker.org

**"Domain not verified":**
- Đảm bảo đã add đủ 5 records
- Check typo trong DNS records
- Thử verify lại sau 1-2 giờ

**Email vẫn từ `onboarding@resend.dev`:**
- Check `.env` đã update chưa
- Restart backend: `npm run dev`

---

## 💡 Tips

### Email Names Hay Dùng:

```env
# Formal
EMAIL_FROM="TEDx Events <events@tedxfptuhcm.com>"

# No Reply
EMAIL_FROM="TEDx Tickets <noreply@tedxfptuhcm.com>"

# Support
EMAIL_FROM="TEDx Support <support@tedxfptuhcm.com>"

# Tickets
EMAIL_FROM="TEDx Ticketing <tickets@tedxfptuhcm.com>"
```

### Dùng Subdomain (nếu domain chính đã dùng):

```env
# Thay vì tedxfptuhcm.com, dùng mail.tedxfptuhcm.com
EMAIL_FROM="TEDx Events <events@mail.tedxfptuhcm.com>"
```

---

## 🎯 Next Steps

Sau khi setup email domain:

1. **Tạo email template đẹp hơn** - Vào Admin → Email Templates
2. **Test spam score** - Gửi email test và check spam folder
3. **Setup DMARC monitoring** - Track email deliverability
4. **Warm up domain** - Gửi ít email đầu tiên, tăng dần

---

## 📚 Full Guide

Xem hướng dẫn đầy đủ: [EMAIL_SETUP.md](./EMAIL_SETUP.md)
