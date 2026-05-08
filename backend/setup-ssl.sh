#!/bin/bash

# Setup SSL for TEDx Backend on Ubuntu Server
# Run this script on the Ubuntu server: sudo bash setup-ssl.sh

set -e

echo "========================================"
echo "TEDx Backend SSL Setup"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root: sudo bash setup-ssl.sh"
    exit 1
fi

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# Create SSL directory
echo "📁 Creating SSL directory..."
mkdir -p /etc/nginx/ssl

# Generate self-signed certificate for IP address
echo "🔐 Generating self-signed SSL certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/server.key \
    -out /etc/nginx/ssl/server.crt \
    -subj "/C=VN/ST=HCM/L=HoChiMinh/O=TEDx/CN=222.255.180.85"

echo "✅ SSL certificate generated"

# Set proper permissions
chmod 600 /etc/nginx/ssl/server.key
chmod 644 /etc/nginx/ssl/server.crt

# Copy nginx config
echo "📝 Installing Nginx configuration..."
cp nginx-ssl.conf /etc/nginx/sites-available/tedx-backend

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Enable site
ln -sf /etc/nginx/sites-available/tedx-backend /etc/nginx/sites-enabled/

# Test nginx config
echo "🧪 Testing Nginx configuration..."
nginx -t

# Restart nginx
echo "🔄 Restarting Nginx..."
systemctl restart nginx
systemctl enable nginx

echo ""
echo "========================================"
echo "✅ SSL Setup Complete!"
echo "========================================"
echo ""
echo "Backend is now available at:"
echo "  HTTPS: https://222.255.180.85"
echo "  HTTP:  http://222.255.180.85 (redirects to HTTPS)"
echo ""
echo "⚠️  Note: Self-signed certificate will show browser warning."
echo "    Users need to accept the certificate to continue."
echo ""
echo "📝 Next steps:"
echo "  1. Update NEXT_PUBLIC_API_URL in web-client/.env to https://222.255.180.85"
echo "  2. Update API_URL in web-admin/.env to https://222.255.180.85"
echo "  3. Rebuild and redeploy frontend apps"
echo ""
