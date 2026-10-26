# Deployment — kpi.namirahamrah.ir

Live at **https://kpi.namirahamrah.ir** — Let's Encrypt certificate (auto-renew
via `certbot.timer`), HTTP/2, HSTS, `http://` redirects to `https://`.

Host: `194.56.148.100` (Ubuntu 24.04, 2 vCPU / 3.8 GB). Three pm2 processes,
PostgreSQL 16 on loopback, nginx in front.

**DNS must be single-valued.** A stale second A record for the hostname (a
parking record pointing at a shared hosting IP) makes certbot fail during
secondary validation and sends half the visitors to a 404 — that is exactly what
happened the first time. `dig +short A kpi.namirahamrah.ir` must return only
`194.56.148.100`.

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
- **`npm run verify` is a dev harness**, not a production health check: it logs
  in as `admin@performance.test / AdminDev!2026`, an account only the
  demo seed creates (`SEED_DEMO_DATA=true`). Against this deployment it fails at
  the first login and does not indicate a broken install. Verify production
  with the CSRF → login → `/auth/me` sequence instead.
- **`pg_dump` cannot read Prisma's `?schema=public` query parameter.** The
  redeploy script strips the query string for the dump only; do the same if you
  back up by hand (`pg_dump "${DATABASE_URL%%\?*}"`), otherwise it exits with
  `invalid URI query parameter: "schema"` before any code is deployed.
