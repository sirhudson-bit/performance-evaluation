# Deployment — kpi.namirahamrah.ir

Host: `194.56.148.100` (Ubuntu 24.04, 2 vCPU / 3.8 GB). Three pm2 processes,
PostgreSQL 16 on loopback, nginx in front, Let's Encrypt for TLS.

| What | Where |
| --- | --- |
| App | `/var/www/kpi` (clone of this repo, deploy key, no push access) |
| Database | `kpi_prod` on `127.0.0.1:5432`, role `kpi`, Prisma migrations |
| Env | `/var/www/kpi/.env` (chmod 600, gitignored) |
| Ports | web `127.0.0.1:3002`, api `127.0.0.1:4000` (loopback only) |
| Processes | `kpi-api`, `kpi-web`, `kpi-worker` |
| Logs | `pm2 logs kpi-web`, `/var/log/kpi/` |
| nginx site | `/etc/nginx/sites-available/kpi` |
| Backups | `/var/backups/kpi/*.sql` (last 10, written by redeploy) |

Port 3000 already belongs to `icdl` and 3001 to `namira` on this box — do not
reuse them. `ss -tlnp` before changing any port.

## First time

```bash
ALLOW_ROOT=1 DB_PASSWORD='<url-safe-password>' SEED=1 \
  bash deploy/kpi/bootstrap.sh
```

`ALLOW_ROOT=1` is only because this host logs in as root. The script prints the
generated admin password once — store it, it is not retrievable later.

## Every release

```bash
cd /var/www/kpi && bash deploy/kpi/redeploy.sh
```

Pulls `main`, dumps the database to `/var/backups/kpi/`, `npm ci -w` the
workspace, applies migrations, rebuilds and reloads pm2. Migrations never drop
data implicitly: `prisma migrate deploy` refuses destructive changes, so a
schema change that needs a destructive step must be planned, not improvised.

## Things that bite here

- **`API_URL` is baked into the Next rewrite at build time.** Changing the API
  port requires a rebuild, not a restart. The web process binds `127.0.0.1`
  only; nginx is the single public entry point.
- **`NODE_ENV=production` in `.env`** makes plain `npm install` skip
  devDependencies (tsx, typescript, prisma CLI). Always `npm ci --include=dev`.
- **The API has no build output.** `npm run build -w @pe/api` is a typecheck;
  production runs the TypeScript sources through `tsx` (see the pm2 config).
- **`APP_KEY` is permanent.** It signs sessions and encrypts stored provider
  credentials; rotating it logs everyone out and makes existing encrypted
  secrets unreadable.
- **Sessions are same-origin.** The browser only ever talks to the Next origin,
  which proxies `/api/v1` to the API, keeping the `SameSite=Lax` cookie valid.
- **Uploads/exports** live under `storage/` (gitignored) — back it up alongside
  the database; a code-only redeploy does not recreate it.
