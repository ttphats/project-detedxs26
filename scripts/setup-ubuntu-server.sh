#!/bin/bash

# Script to setup Backend on Ubuntu Server

echo "🚀 Setting up Backend on Ubuntu Server..."
echo ""

# Variables (edit these)
SERVER_IP="222.255.180.85"
SERVER_USER="root"  # Change to your user
PROJECT_DIR="/var/www/tedx-backend"
REPO_URL="https://github.com/ttphats/project-detedxs26.git"

echo "📋 Configuration:"
echo "   Server: $SERVER_USER@$SERVER_IP"
echo "   Directory: $PROJECT_DIR"
echo "   Repository: $REPO_URL"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo "🔧 Running setup on server..."
echo ""

ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
# Update system
echo "📦 Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools
sudo apt install -y build-essential

# Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Redis (if not installed)
if ! command -v redis-server &> /dev/null; then
    echo "📦 Installing Redis..."
    sudo apt install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
fi

# Create project directory
echo "📁 Creating project directory..."
sudo mkdir -p /var/www/tedx-backend
sudo chown -R $USER:$USER /var/www/tedx-backend

# Clone repository
echo "📥 Cloning repository..."
if [ -d "/var/www/tedx-backend/.git" ]; then
    echo "   Repository already exists, pulling latest..."
    cd /var/www/tedx-backend
    git pull
else
    git clone https://github.com/ttphats/project-detedxs26.git /var/www/tedx-backend
fi

# Setup backend
echo "🔧 Setting up backend..."
cd /var/www/tedx-backend/backend

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building TypeScript..."
npm run build

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=production

# DATABASE
DATABASE_URL="mysql://rymukbi_admin:Admin%402026@103.179.188.241:3306/rymukbi_easyticketdb"
DB_HOST=103.179.188.241
DB_PORT=3306
DB_USER=rymukbi_admin
DB_PASSWORD=Admin@2026
DB_NAME=rymukbi_easyticketdb

# JWT
JWT_SECRET=8dbeed8a671eec89989ae43593f956fb3f62e4b944acd3e8d9193c000eb0f649cc033da0d9212e8e9b6cff748d7b4a8e628d633551ab07951c7a1a1eb95c5a0a
JWT_EXPIRES_IN=7d

# Redis (Local)
REDIS_URL=redis://:ttphats1504@127.0.0.1:6379/0
REDIS_TOKEN=ttphats1504

# Email
EMAIL_PROVIDER=resend
EMAIL_FROM="TEDxFPT University HCMC <onboarding@resend.dev>"
RESEND_API_KEY=re_S7rTjxuw_25cPnF4cMJBHMMtUHg43jnxr

# Client URL
CLIENT_URL=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60

# Seat Lock TTL
SEAT_LOCK_TTL=300

# CORS
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# Cron Secret
CRON_SECRET=abc123

# CLOUDINARY
CLOUDINARY_URL=cloudinary://415597173285343:fwsKHBt_f_vqqqXyjM3PMaG_EqI@dug62fhtq
CLOUDINARY_FOLDER=tedx-fptuhcmc
EOF
    echo "   ⚠️  Please edit .env file with your settings!"
fi

# Start with PM2
echo "🚀 Starting backend with PM2..."
pm2 delete tedx-backend 2>/dev/null || true
pm2 start npm --name "tedx-backend" -- run start

# Setup PM2 startup
pm2 startup | tail -n 1 | bash
pm2 save

echo ""
echo "✅ Setup completed!"
echo ""
echo "📊 Status:"
pm2 status tedx-backend

echo ""
echo "📝 Next steps:"
echo "1. Edit .env file: nano /var/www/tedx-backend/backend/.env"
echo "2. Update CORS_ORIGINS and CLIENT_URL with your domains"
echo "3. Restart: pm2 restart tedx-backend"
echo "4. Check logs: pm2 logs tedx-backend"

ENDSSH

echo ""
echo "✅ Server setup completed!"
echo ""
echo "📝 Remember to:"
echo "1. Add SSH key to GitHub Secrets for CI/CD"
echo "2. Test deployment with: git push origin main"
