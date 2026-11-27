#!/usr/bin/env bash
# Run on the server as `arise`:  ~/arise/deploy.sh
set -e

cd ~/arise
git pull --ff-only

cd Backend
npm ci --omit=dev
node scripts/syncIndexes.mjs

cd ../Ecommerce_admin_UI
npm ci
VITE_API_BASE_URL=/api/admin/v1 VITE_API_MODE=live npm run build

pm2 restart ecom-api ecom-worker ecom-outbox ecom-scheduler --update-env
pm2 save

sleep 10
curl -f http://127.0.0.1:4000/health/ready
echo
echo "Deployed."
