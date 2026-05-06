# Email Setup - Đổi từ `onboarding@resend.dev` sang Email Riêng

## 🎯 Mục tiêu

Đổi từ email test `onboarding@resend.dev` sang email domain riêng như:
- `events@tedxfptuhcm.com`
- `noreply@tedxfptuhcm.com`
- `tickets@tedxfptuhcm.com`

---

## ✅ Option 1: Dùng Domain với Resend (RECOMMENDED)

### Ưu điểm:
- ✅ Miễn phí (với Resend free tier: 100 emails/day, 3000 emails/month)
- ✅ Dễ setup (chỉ cần add DNS records)
- ✅ Deliverability cao (inbox rate ~98%)
- ✅ Không cần maintain email server

### Bước 1: Mua Domain (nếu chưa có)

Ví dụ: `tedxfptuhcm.com` từ:
- Namecheap (~$10/year)
- GoDaddy
- Google Domains
- Cloudflare

### Bước 2: Add Domain vào Resend

1. Đăng nhập: https://resend.com/domains
2. Click **"Add Domain"**
3. Nhập domain: `tedxfptuhcm.com`
4. Click **"Add"**

### Bước 3: Get DNS Records

Resend sẽ hiển thị các DNS records cần add:

**SPF Record:**
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
```

**DKIM Records (3 records):**
```
Type: TXT
Name: resend._domainkey
Value: [long string provided by Resend]

Type: TXT
Name: resend2._domainkey
Value: [long string provided by Resend]

Type: TXT
Name: resend3._domainkey
Value: [long string provided by Resend]
```

**DMARC Record:**
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@tedxfptuhcm.com
```

### Bước 4: Add DNS Records vào Domain Provider

#### Nếu dùng Cloudflare:
1. Vào Cloudflare Dashboard
2. Chọn domain `tedxfptuhcm.com`
3. Click **DNS** tab
4. Click **"Add record"**
5. Copy-paste từng record từ Resend
6. Click **Save**

#### Nếu dùng Namecheap:
1. Vào Namecheap Dashboard
2. Click **"Manage"** bên cạnh domain
3. Click **"Advanced DNS"**
4. Click **"Add New Record"**
5. Copy-paste từng record từ Resend
6. Click **Save**

### Bước 5: Verify Domain trên Resend

1. Đợi 5-60 phút (cho DNS propagate)
2. Quay lại Resend Dashboard
3. Click **"Verify"** bên cạnh domain
4. Nếu thành công → ✅ **"Verified"**

### Bước 6: Update `.env`

```env
# Email - Resend
EMAIL_PROVIDER=resend
EMAIL_FROM="TEDx Events <events@tedxfptuhcm.com>"
RESEND_API_KEY=re_S7rTjxuw_25cPnF4cMJBHMMtUHg43jnxr

# Hoặc dùng noreply
EMAIL_FROM="TEDx FPT University HCMC <noreply@tedxfptuhcm.com>"

# Hoặc dùng tickets
EMAIL_FROM="TEDx Tickets <tickets@tedxfptuhcm.com>"
```

### Bước 7: Test

```bash
cd backend
node scripts/test-flow.mjs
```

Check email inbox - sẽ nhận email từ `events@tedxfptuhcm.com` thay vì `onboarding@resend.dev`!

---

## ⚡ Option 2: Dùng Subdomain (Nếu không muốn dùng domain chính)

Nếu domain chính `tedxfptuhcm.com` đang dùng cho website, có thể dùng subdomain:

**Domain chính**: `tedxfptuhcm.com`  
**Subdomain**: `mail.tedxfptuhcm.com`

1. Add domain `mail.tedxfptuhcm.com` vào Resend
2. Add DNS records (tương tự bước trên)
3. Update `.env`:

```env
EMAIL_FROM="TEDx Events <events@mail.tedxfptuhcm.com>"
```

---

## 📧 Option 3: Dùng Gmail/Google Workspace (Nếu muốn email @gmail.com)

### Chi phí:
- Google Workspace: **$6/user/month**
- Hoặc dùng Gmail App Password (miễn phí nhưng kém tin cậy hơn)

### Setup:

1. **Đăng ký Google Workspace**: https://workspace.google.com
2. **Add user**: `events@tedxfptuhcm.com`
3. **Tạo App Password**:
   - Vào Google Account → Security
   - 2-Step Verification → App passwords
   - Tạo password cho "Mail"
4. **Update backend code**:

Create `backend/src/services/smtp-email.service.ts`:

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(options) {
  const result = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  
  return { success: true, emailId: result.messageId };
}
```

5. **Update `.env`**:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=events@tedxfptuhcm.com
SMTP_PASS=your-16-digit-app-password
EMAIL_FROM="TEDx Events <events@tedxfptuhcm.com>"
```

6. **Install nodemailer**:

```bash
npm install nodemailer
```

---

## 🏆 So Sánh Options

| Feature | Resend + Domain | Gmail/Google Workspace |
|---------|----------------|----------------------|
| **Chi phí** | Miễn phí (100 emails/day) | $6/user/month |
| **Setup** | Dễ (chỉ DNS) | Trung bình |
| **Deliverability** | Cao (~98%) | Cao (~95%) |
| **Limit** | 100/day (free), 50k/month (paid $20) | Không limit |
| **Spam score** | Thấp | Thấp |
| **Support** | Email support | 24/7 support |

### Recommendation:

✅ **Resend + Domain** nếu:
- Dùng < 100 emails/day
- Muốn setup nhanh
- Không muốn trả phí hàng tháng

✅ **Google Workspace** nếu:
- Cần > 100 emails/day
- Muốn dùng Gmail interface
- Cần email cho nhiều người (team)

---

## 🔍 Verify Setup

Sau khi setup xong, test bằng:

```bash
cd backend
node scripts/test-flow.mjs
```

Hoặc test thủ công:

```bash
curl -X POST http://localhost:4000/api/test/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@gmail.com","subject":"Test","html":"<h1>Test</h1>"}'
```

Check inbox → Email từ domain riêng! 🎉

---

## ⚠️ Troubleshooting

### DNS records không verify được:
- Đợi 24-48 giờ cho DNS propagate
- Check DNS với tool: https://mxtoolbox.com/SuperTool.aspx
- Paste domain vào → Check TXT records

### Email vào Spam:
- Đảm bảo đã add DMARC record
- Đảm bảo SPF, DKIM đã verify
- Warm up domain (gửi ít email đầu tiên, tăng dần)

### Resend API error:
- Check API key còn valid
- Check domain đã verify
- Check quota (100 emails/day on free tier)
