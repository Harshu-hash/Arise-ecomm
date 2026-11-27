#!/usr/bin/env bash
# Deploys the ecom stack on the server. Run as the `arise` user:  ~/arise/deploy.sh
# Only touches the ecom-* PM2 processes; the food app and ecom-redis are left alone.
set -euo pipefail

command -v node >/dev/null || export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Tracked files have local changes; commit or discard them first." >&2
  exit 1
fi

OLD=$(git rev-parse HEAD)
git pull --ff-only
NEW=$(git rev-parse HEAD)
CHANGED=$(git diff --name-only "$OLD" "$NEW")
changed() { grep -qE "$1" <<<"$CHANGED"; }
echo "Deploying ${OLD:0:7} -> ${NEW:0:7}"

cd "$ROOT/Backend"
if changed '^Backend/package(-lock)?\.json$' || [ ! -d node_modules ]; then npm ci --omit=dev; fi
# Production runs with autoIndex off, so rebuild indexes whenever backend code (schemas) changed.
if changed '^Backend/src/'; then node scripts/syncIndexes.mjs; fi

cd "$ROOT/Ecommerce_admin_UI"
if changed '^Ecommerce_admin_UI/' || [ ! -d dist ]; then
  npm ci
  VITE_API_BASE_URL=/api/admin/v1 VITE_API_MODE=live npm run build
fi

pm2 restart ecom-api ecom-worker ecom-outbox ecom-scheduler --update-env
pm2 save >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/health/ready | grep -q '"status":"ok"'; then
    echo "Healthy. Deployed ${NEW:0:7} (previous: ${OLD:0:7})."
    exit 0
  fi
  sleep 2
done
echo "API not healthy after deploy; see: pm2 logs ecom-api" >&2
exit 1
