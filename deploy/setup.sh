#!/bin/bash
# QONNECT EC2 Setup Script
# Run once on a fresh Ubuntu 22.04 instance:
# chmod +x setup.sh && sudo ./setup.sh

set -e

echo "🚀 QONNECT EC2 Setup"

# Update system
apt-get update -y && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2, Nginx, Certbot
npm install -g pm2
apt-get install -y nginx certbot python3-certbot-nginx git

# Create app directory
mkdir -p /var/www/qonnect
chown -R ubuntu:ubuntu /var/www/qonnect

echo "✅ System ready. Now run deploy.sh"
