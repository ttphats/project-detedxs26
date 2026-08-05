# 🚀 TEDx Deployment Guide

Hướng dẫn setup CI/CD với GitHub Actions để deploy **Backend** lên Ubuntu Server.

---

## 📋 **Prerequisites**

### **Tạo SSH Key cho GitHub Actions:**

```bash
# Trên máy local, tạo SSH key mới
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Copy public key lên server
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@222.255.180.85

# Test connection
ssh -i ~/.ssh/github_actions_deploy user@222.255.180.85
```

### **Setup Backend trên Ubuntu:**

```bash
# SSH vào server
ssh user@222.255.180.85

# Tạo thư mục project
sudo mkdir -p /var/www/tedx-backend
sudo chown -R $USER:$USER /var/www/tedx-backend

# Clone repository
cd /var/www/tedx-backend
git clone https://github.com/ttphats/project-detedxs26.git .

# Install dependencies
cd backend
npm install

# Build
npm run build

# Setup PM2
npm install -g pm2
pm2 start npm --name "tedx-backend" -- run start
pm2 startup
pm2 save
```

---

## 🔐 **GitHub Secrets Setup**

Vào GitHub repository → Settings → Secrets and variables → Actions → New repository secret

### **SSH Secrets:**

| Secret Name       | Value               | Example                                      |
| ----------------- | ------------------- | -------------------------------------------- |
| `SSH_HOST`        | Server IP           | `222.255.180.85`                             |
| `SSH_USERNAME`    | SSH user            | `root` hoặc `ubuntu`                         |
| `SSH_PRIVATE_KEY` | Private key content | Nội dung file `~/.ssh/github_actions_deploy` |
| `SSH_PORT`        | SSH port            | `22`                                         |

**Lấy Private Key:**

```bash
cat ~/.ssh/github_actions_deploy
# Copy toàn bộ nội dung (bao gồm -----BEGIN ... và -----END ...)
```

---

## 🚀 **Deployment Flow**

### Auto Deploy (khi push code):

```bash
# Push to main branch
git add .
git commit -m "feat: new feature"
git push origin main
```

### Manual Deploy:

1. Vào GitHub repository
2. Actions tab
3. Click workflow "Deploy Backend to Ubuntu"
4. Click "Run workflow"
5. Chọn branch
6. Click "Run workflow"

---

## 📊 **Check Backend Status**

```bash
# SSH vào server
ssh user@222.255.180.85

# Check PM2
pm2 status tedx-backend
pm2 logs tedx-backend --lines 50

# Check backend API
curl http://localhost:4000/health
```

---

## 🔧 **Troubleshooting**

### Backend deployment failed:

```bash
# SSH vào server
ssh user@222.255.180.85

# Check git status
cd /var/www/tedx-backend
git status
git log -1

# Manual build
cd backend
npm install
npm run build

# Restart PM2
pm2 restart tedx-backend
pm2 logs tedx-backend
```

### SSH connection failed:

```bash
# Test SSH from local
ssh -i ~/.ssh/github_actions_deploy user@222.255.180.85

# Check server SSH config
sudo nano /etc/ssh/sshd_config
# Ensure: PubkeyAuthentication yes
sudo systemctl restart sshd
```

---

## 📝 **Environment Variables**

### Web Client (`.env.production`):

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

### Web Admin (`.env.production`):

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

### Backend (`.env` on server):

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=mysql://user:pass@host:3306/db
REDIS_URL=redis://:password@127.0.0.1:6379/0
```

Setup these in:

- **Vercel:** Project Settings → Environment Variables
- **Ubuntu:** `/var/www/tedx-backend/backend/.env`

---

## ✅ **Post-Deployment Checklist**

- [ ] Vercel domains configured
- [ ] Backend API accessible
- [ ] Database connected
- [ ] Redis connected
- [ ] CORS origins updated
- [ ] SSL certificates (if custom domain)
- [ ] PM2 auto-restart enabled
- [ ] Monitoring setup (optional)
