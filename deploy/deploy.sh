#!/bin/bash
# QONNECT Deploy Script
# Run from /var/www/qonnect after cloning the repo

set -e

echo "📦 Deploying QONNECT..."

# Pull latest
git pull origin main

# Install dependencies
npm install --production=false

# Build frontend
npm run build

# Restart server via PM2
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs

pm2 save

echo "✅ QONNECT deployed"
