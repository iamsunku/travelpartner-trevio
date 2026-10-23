#!/usr/bin/env bash
# One-time Hostinger VPS bootstrap for treviogobal.com
# Usage (as root or sudo): bash deploy/hostinger/setup-server.sh
set -euo pipefail

APP_ROOT="${TREVIO_APP_ROOT:-/var/www/treviogobal}"
REPO_URL="${TREVIO_REPO_URL:-https://github.com/trevioglobal/Trevioglobal.git}"
BRANCH="${TREVIO_BRANCH:-main}"
NODE_MAJOR="${TREVIO_NODE_MAJOR:-20}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (or: sudo bash $0)"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Updating apt packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw git nginx certbot python3-certbot-nginx

echo "==> Installing Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Installing PM2 globally"
npm install -g pm2

echo "==> Firewall (allow SSH/HTTP/HTTPS)"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

echo "==> App directory ${APP_ROOT}"
mkdir -p "$(dirname "$APP_ROOT")"
mkdir -p /var/www/certbot

if [[ ! -d "${APP_ROOT}/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_ROOT"
else
  echo "Repo already present at ${APP_ROOT}"
fi

DEPLOY_DIR="${APP_ROOT}/deploy/hostinger"
if [[ -f "${DEPLOY_DIR}/nginx-treviogobal.http-only.conf" ]]; then
  cp "${DEPLOY_DIR}/nginx-treviogobal.http-only.conf" /etc/nginx/sites-available/treviogobal
  ln -sf /etc/nginx/sites-available/treviogobal /etc/nginx/sites-enabled/treviogobal
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable nginx
  systemctl reload nginx
fi

echo ""
echo "Setup complete."
echo "Next:"
echo "  1. Create ${APP_ROOT}/backend/.env from deploy/hostinger/env.backend.example"
echo "  2. Create ${APP_ROOT}/frontend/.env.production from deploy/hostinger/env.frontend.example"
echo "  3. bash ${DEPLOY_DIR}/deploy.sh"
echo "  4. After DNS points here: certbot --nginx -d treviogobal.com -d www.treviogobal.com"
echo "  5. Optional: replace nginx site with nginx-treviogobal.conf (HTTPS redirects)"
echo "  6. pm2 startup && pm2 save"
