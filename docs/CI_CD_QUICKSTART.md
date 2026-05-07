# 🚀 CI/CD Quick Start Guide

Quick setup guide để deploy Backend lên Ubuntu Server với GitHub Actions.

---

## ⚡ **Quick Setup (3 phút)**

### **Bước 1: Setup GitHub Secrets** (2 phút)

Vào: `GitHub Repository → Settings → Secrets → Actions → New repository secret`

Thêm secrets sau:

```yaml
# Ubuntu Server SSH
SSH_HOST: 222.255.180.85
SSH_USERNAME: root
SSH_PRIVATE_KEY: | # Private key content
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...
  -----END OPENSSH PRIVATE KEY-----
SSH_PORT: 22
```

**Lấy SSH Private Key:**

```bash
# Tạo SSH key mới (nếu chưa có)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Copy public key lên server
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@222.255.180.85

# Copy private key content để thêm vào GitHub Secret
cat ~/.ssh/github_actions_deploy
```

### **Bước 2: Setup Ubuntu Server** (1 phút - tùy chọn)

Nếu chưa setup server:

```bash
chmod +x scripts/setup-ubuntu-server.sh
./scripts/setup-ubuntu-server.sh
```

---

## 🎯 **Deploy**

### **Auto Deploy:**

```bash
git add .
git commit -m "Deploy new changes"
git push origin main
```

### **Manual Deploy:**

1. Vào GitHub Actions tab
2. Click "Deploy Backend to Ubuntu"
3. Click "Run workflow"

---

## 📊 **Check Status**

```bash
ssh user@222.255.180.85
pm2 status tedx-backend
pm2 logs tedx-backend
```

---

## 🔧 **Troubleshooting**

### "SSH connection failed"

```bash
# Test SSH
ssh -i ~/.ssh/id_ed25519 user@222.255.180.85

# Re-generate key
ssh-keygen -t ed25519 -C "github-actions"
```

### "Backend build failed"

```bash
ssh user@222.255.180.85
cd /var/www/tedx-backend/backend
npm install
npm run build
pm2 restart tedx-backend
```

---

## 📖 **Full Documentation**

Xem chi tiết: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)

---

## ✅ **Checklist**

- [ ] Vercel projects linked
- [ ] GitHub secrets configured
- [ ] Ubuntu server setup
- [ ] Test deployment works
- [ ] Production domains configured
- [ ] Environment variables updated
