#!/usr/bin/env bash
# Deploy / update Trevio on Hostinger VPS
# Usage: bash deploy/hostinger/deploy.sh
set -euo pipefail

APP_ROOT="${TREVIO_APP_ROOT:-/var/www/treviogobal}"
BRANCH="${TREVIO_BRANCH:-main}"
DEPLOY_DIR="${APP_ROOT}/deploy/hostinger"

cd "$APP_ROOT"

if [[ ! -f backend/.env ]]; then
  echo "Missing backend/.env — copy from deploy/hostinger/env.backend.example and fill secrets."
  exit 1
fi

if [[ ! -f frontend/.env.production ]]; then
  echo "Missing frontend/.env.production — copy from deploy/hostinger/env.frontend.example."
  exit 1
fi

echo "==> Pulling ${BRANCH}"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Installing dependencies (workspaces)"
# Include devDependencies so TypeScript / Next build tools are available
npm ci --include=dev

echo "==> Prisma generate + migrate"
cd backend
npx prisma generate
npx prisma migrate deploy
cd "$APP_ROOT"

echo "==> Building backend"
npm run build --workspace=travelpro-backend

echo "==> Building frontend (uses frontend/.env.production)"
npm run build --workspace=travelpro-frontend

echo "==> Restarting PM2"
mkdir -p /var/log/treviogobal
pm2 startOrReload "${DEPLOY_DIR}/ecosystem.config.cjs" --update-env
pm2 save

echo "==> Health checks"
sleep 2
curl -fsS "http://127.0.0.1:4000/api/health" || echo "WARN: API health check failed"
curl -fsSI "http://127.0.0.1:3100" | head -n 1 || echo "WARN: Frontend health check failed"

echo "Deploy finished. Public URL: https://www.treviogobal.com"
