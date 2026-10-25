#!/usr/bin/env bash
# kpi.namirahamrah.ir — first-time server bootstrap (Ubuntu 22.04 / 24.04).
#
#   ALLOW_ROOT=1 DB_PASSWORD='…' SEED=1 bash deploy/kpi/bootstrap.sh
#
# Installs PostgreSQL + Node + pm2 + nginx, creates the database, generates a
# .env, migrates, builds and starts all three processes. Idempotent.

set -euo pipefail

APP_NAME="${APP_NAME:-kpi}"
APP_DIR="${APP_DIR:-/var/www/kpi}"
DOMAIN="${DOMAIN:-kpi.namirahamrah.ir}"
WEB_PORT="${WEB_PORT:-3002}"
API_PORT="${API_PORT:-4000}"
DB_NAME="${DB_NAME:-kpi_prod}"
DB_USER="${DB_USER:-kpi}"
DB_PASSWORD="${DB_PASSWORD:-}"
REPO="${REPO:-git@github.com:sirhudson-bit/performance-evaluation.git}"
BRANCH="${BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SEED="${SEED:-0}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN#kpi.}}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

if [[ "$(id -u)" -eq 0 && "${ALLOW_ROOT:-0}" != "1" ]]; then
  die "Do not run as root. Use a sudo user (or set ALLOW_ROOT=1 on a root-only box)."
fi
command -v apt-get >/dev/null || die "Ubuntu/Debian only."
[[ -n "$DB_PASSWORD" ]] || die "Set DB_PASSWORD (the PostgreSQL role password)."
[[ "$DB_PASSWORD" =~ ^[A-Za-z0-9._-]+$ ]] || die "DB_PASSWORD must be URL-safe (letters, digits, ._-)."

# ── 1. Packages ─────────────────────────────────────────────────────────────
log "Installing system packages"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git ca-certificates ufw nginx postgresql postgresql-contrib

# ── 2. Node ─────────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  log "Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y -qq nodejs
else
  log "Node $(node -v) OK"
fi
command -v pm2 >/dev/null 2>&1 || { log "Installing pm2"; sudo npm install -g pm2; }

# ── 3. PostgreSQL role + database ───────────────────────────────────────────
log "Ensuring PostgreSQL role ${DB_USER} and database ${DB_NAME}"
sudo systemctl enable --now postgresql
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

# ── 4. Source ───────────────────────────────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  log "Updating $APP_DIR"
  git -C "$APP_DIR" fetch --prune origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  log "Cloning into $APP_DIR"
  sudo mkdir -p "$(dirname "$APP_DIR")"
  sudo chown "$(id -u):$(id -g)" "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

# ── 5. .env ─────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  log "Generating .env"
  app_key="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  cron_secret="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')"
  admin_pw="$(node -e 'console.log(require("crypto").randomBytes(12).toString("base64url"))')"
  cat > .env <<EOF
# ${DOMAIN} — production environment (chmod 600, never commit)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"

APP_KEY="${app_key}"
CRON_SECRET="${cron_secret}"

APP_URL="https://${DOMAIN}"
APP_NAME="سامانه ارزیابی عملکرد"

API_PORT="${API_PORT}"
API_URL="http://127.0.0.1:${API_PORT}"

SESSION_COOKIE_NAME="pe_session"
SESSION_TTL_SECONDS="43200"

SMTP_HOST=""
SMTP_PORT=""
SMTP_SECURE=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM=""

SEED_DEMO_DATA="false"
SEED_ADMIN_EMAIL="${ADMIN_EMAIL}"
SEED_ADMIN_PASSWORD="${admin_pw}"

NODE_ENV="production"
EOF
  chmod 600 .env
  warn "Bootstrap admin: ${ADMIN_EMAIL} / ${admin_pw}  (printed once, store it now)"
else
  log ".env exists — leaving it untouched"
fi

# ── 6. Build ────────────────────────────────────────────────────────────────
log "Installing dependencies"
npm ci --include=dev

log "Applying migrations"
npx prisma generate
npx prisma migrate deploy

if [[ "$SEED" == "1" ]]; then
  log "Seeding (admin from .env)"
  npm run db:seed
else
  warn "Skipped seeding. Run 'npm run db:seed' before the first login, or re-run with SEED=1."
fi

mkdir -p storage/exports
log "Building (API_URL is baked into the Next rewrite)"
API_URL="http://127.0.0.1:${API_PORT}" npm run build

# ── 7. pm2 ──────────────────────────────────────────────────────────────────
log "Starting pm2 processes"
sudo mkdir -p /var/log/"$APP_NAME"
sudo chown -R "$(id -u):$(id -g)" /var/log/"$APP_NAME"
APP_DIR="$APP_DIR" WEB_PORT="$WEB_PORT" API_PORT="$API_PORT" APP_NAME="$APP_NAME" \
  pm2 startOrReload deploy/kpi/ecosystem.config.cjs --update-env
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null || true

# ── 8. nginx ────────────────────────────────────────────────────────────────
log "Writing nginx site for ${DOMAIN}"
sed "s/__DOMAIN__/${DOMAIN}/g; s/__WEB_PORT__/${WEB_PORT}/g" deploy/kpi/nginx.conf \
  | sudo tee /etc/nginx/sites-available/"$APP_NAME" >/dev/null
sudo ln -sf /etc/nginx/sites-available/"$APP_NAME" /etc/nginx/sites-enabled/"$APP_NAME"
sudo nginx -t && sudo systemctl reload nginx

# ── 9. Firewall ─────────────────────────────────────────────────────────────
sudo ufw allow OpenSSH >/dev/null 2>&1 || true
sudo ufw allow 'Nginx Full' >/dev/null 2>&1 || true
sudo ufw --force enable >/dev/null 2>&1 || true

log "Done"
printf '  Health: curl -H "Host: %s" http://127.0.0.1/\n' "$DOMAIN"
printf '  Logs  : pm2 logs %s-{api,web,worker}  |  /var/log/%s/\n\n' "$APP_NAME" "$APP_NAME"
printf 'TLS (after the DNS record exists):\n'
printf '  sudo apt-get install -y certbot python3-certbot-nginx\n'
printf '  sudo certbot --nginx -d %s\n' "$DOMAIN"
