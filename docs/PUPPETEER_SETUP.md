# 🤖 Puppeteer Setup for PDF Generation

## Problem
Server-side PDF generation với Puppeteer cần Chrome/Chromium và các dependencies. Nếu thiếu sẽ gặp lỗi:
```
Error: Failed to launch the browser process!
```

## Solution

### Option 1: Auto Install (Recommended)

Run script tự động:
```bash
# SSH vào server
ssh user@your-server-ip

# Navigate to project
cd /var/www/tedx-backend

# Run install script
chmod +x scripts/install-puppeteer-deps.sh
sudo bash scripts/install-puppeteer-deps.sh

# Rebuild backend
cd backend
npm install
npm run build

# Restart PM2
pm2 restart tedx-backend
```

### Option 2: Manual Install

```bash
# Update package list
sudo apt-get update

# Install Chrome dependencies
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# Install fonts
sudo apt-get install -y \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf
```

## Verification

Test Puppeteer:
```bash
cd backend
node -e "const puppeteer = require('puppeteer'); (async () => { const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']}); console.log('✅ Puppeteer works!'); await browser.close(); })()"
```

## Troubleshooting

### Error: "Could not find Chrome"
```bash
# Install Chromium
sudo apt-get install -y chromium-browser
```

### Error: "libgbm.so.1: cannot open shared object file"
```bash
sudo apt-get install -y libgbm1
```

### Permission Issues
```bash
# Make sure PM2 has access to Puppeteer
pm2 restart tedx-backend --update-env
```

### Check logs
```bash
pm2 logs tedx-backend --lines 50
```

## Files Modified
- ✅ `scripts/install-puppeteer-deps.sh` - Auto install script
- ✅ `.github/workflows/deploy.yml` - Auto install in CI/CD
- ✅ `backend/package.json` - Puppeteer dependency added
- ✅ `backend/src/controllers/ticket-pdf.controller.ts` - PDF generation logic

## Next Steps After Setup
1. Test PDF download from ticket page
2. Check server logs: `pm2 logs tedx-backend`
3. Verify PDF quality and layout
