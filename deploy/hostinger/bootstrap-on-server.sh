#!/usr/bin/env bash
# Paste this whole script into the Hostinger VPS browser terminal (or SSH session)
# after setting the required environment variables below.
#
# Required exports before running:
#   export DATABASE_URL='postgresql://...'
#   export DIRECT_URL='postgresql://...'
#   export JWT_SECRET='long-random-32+-chars'
#
# Optional:
#   export TREVIO_REPO_URL='https://github.com/trevioglobal/Trevioglobal.git'
#   export TREVIO_BRANCH='main'
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL}"
: "${DIRECT_URL:?Set DIRECT_URL}"
: "${JWT_SECRET:?Set JWT_SECRET}"

APP_ROOT="${TREVIO_APP_ROOT:-/var/www/treviogobal}"
REPO_URL="${TREVIO_REPO_URL:-https://github.com/trevioglobal/Trevioglobal.git}"
BRANCH="${TREVIO_BRANCH:-main}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run as root: sudo bash $0"
  exit 1
fi

if [[ ! -d "${APP_ROOT}/.git" ]]; then
  mkdir -p "$(dirname "$APP_ROOT")"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_ROOT"
fi

bash "${APP_ROOT}/deploy/hostinger/setup-server.sh"

cat > "${APP_ROOT}/backend/.env" <<EOF
NODE_ENV=production
PORT=4000
DATABASE_URL=${DATABASE_URL}
DIRECT_URL=${DIRECT_URL}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1d
CORS_ORIGIN=https://www.treviogobal.com,https://treviogobal.com,http://200.234.47.151
PUBLIC_APP_ORIGIN=https://www.treviogobal.com
ALLOW_DEMO_PAYMENTS=false
ALLOW_PUBLIC_REGISTRATION=false
ALLOW_INSECURE_TEMP_PASSWORD_RESPONSE=false
EOF

cat > "${APP_ROOT}/frontend/.env.production" <<EOF
NEXT_PUBLIC_API_URL=https://www.treviogobal.com
NEXT_PUBLIC_APP_MODE=live
NEXT_PUBLIC_ENABLE_MOCK_INVENTORY=false
NEXT_PUBLIC_ENABLE_STUB_MODULES=false
NEXT_PUBLIC_SHOW_DEMO_LOGIN=false
NEXT_PUBLIC_ALLOW_PUBLIC_REGISTER=false
EOF

# Until DNS/SSL exist, also allow testing via IP by rebuilding with API URL = IP
# Comment the next block out once https://www.treviogobal.com works.
if ! getent hosts treviogobal.com >/dev/null 2>&1; then
  echo "WARN: treviogobal.com not in DNS yet — building frontend against http://200.234.47.151"
  cat > "${APP_ROOT}/frontend/.env.production" <<EOF
NEXT_PUBLIC_API_URL=http://200.234.47.151
NEXT_PUBLIC_APP_MODE=live
NEXT_PUBLIC_ENABLE_MOCK_INVENTORY=false
NEXT_PUBLIC_ENABLE_STUB_MODULES=false
NEXT_PUBLIC_SHOW_DEMO_LOGIN=false
NEXT_PUBLIC_ALLOW_PUBLIC_REGISTER=false
EOF
fi

bash "${APP_ROOT}/deploy/hostinger/deploy.sh"
pm2 startup systemd -u root --hp /root | tail -n 1 | bash || true
pm2 save

echo "Bootstrap done. Test: curl -fsS http://127.0.0.1:4000/api/health"
echo "Public: http://200.234.47.151  (or https://www.treviogobal.com after DNS + certbot)"
