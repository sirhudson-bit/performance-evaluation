#!/usr/bin/env bash
# kpi.namirahamrah.ir — ship a new commit to the server.
#
#   cd /var/www/kpi && bash deploy/kpi/redeploy.sh
#
# Pulls the branch, reinstalls deps, backs up the database, migrates, rebuilds
# and restarts the three pm2 processes. A migration that would destroy data
# fails loudly (prisma migrate deploy never drops anything silently).

set -euo pipefail

APP_NAME="${APP_NAME:-kpi}"
# Captured before `.env` is sourced: that file defines APP_NAME for the UI.
PM2_APP_NAME="$APP_NAME"
APP_DIR="${APP_DIR:-/var/www/kpi}"
BRANCH="${BRANCH:-main}"
WEB_PORT="${WEB_PORT:-3002}"
API_PORT="${API_PORT:-4000}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

cd "$APP_DIR" 2>/dev/null || die "$APP_DIR not found — run deploy/kpi/bootstrap.sh first."
[[ -f .env ]] || die ".env missing in $APP_DIR"

log "Pulling $BRANCH"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

log "Backing up the database"
set -a; . ./.env; set +a
mkdir -p /var/backups/kpi
# `DATABASE_URL` carries Prisma's `?schema=public` query parameter. libpq's
# pg_dump rejects that parameter ("invalid URI query parameter: schema"), so the
# dump uses the same URL without its query string. Prisma still gets the full
# URL from .env.
DUMP_URL="${DATABASE_URL%%[?]*}"
pg_dump "$DUMP_URL" > "/var/backups/kpi/kpi-$(date +%Y%m%d-%H%M%S).sql"
ls -1t /var/backups/kpi/*.sql 2>/dev/null | tail -n +11 | xargs -r rm --

log "Installing dependencies"
npm ci --include=dev

log "Applying migrations"
npx prisma generate
npx prisma migrate deploy

log "Building"
API_URL="http://127.0.0.1:${API_PORT}" npm run build

log "Restarting processes"
APP_DIR="$APP_DIR" WEB_PORT="$WEB_PORT" API_PORT="$API_PORT" PM2_APP_NAME="$PM2_APP_NAME" \
  pm2 startOrReload deploy/kpi/ecosystem.config.cjs --update-env
pm2 save

log "Verifying"
# pm2 reload returns before the Next server has bound its port; polling avoids a
# false "web -> 000" on every successful deploy.
for _ in $(seq 1 30); do
  curl -sf -o /dev/null "http://127.0.0.1:${WEB_PORT}/" && break
  sleep 1
done
curl -s -o /dev/null -w "web  (127.0.0.1:${WEB_PORT}) -> %{http_code}\n" "http://127.0.0.1:${WEB_PORT}/"
curl -s -o /dev/null -w "api  (127.0.0.1:${API_PORT}/api/v1/health) -> %{http_code}\n" "http://127.0.0.1:${API_PORT}/api/v1/health" || true
pm2 status --no-color | sed -n '1,12p'
