# Deployment

## Requirements

- Node.js 20+
- PostgreSQL 14+
- A reverse proxy for HTTPS in production

## Environment

Copy `.env.example` to `.env` and set at minimum:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_KEY` | 32-byte base64 key (signs/encrypts; treat as permanent) |
| `CRON_SECRET` | Bearer token for the job drain endpoint |
| `APP_URL` | Public web origin |
| `API_URL` | API origin used by the web server-side proxy |

Optional (graceful degradation when unset): `SMTP_*`. Redis is **not** required.

## Build & run

```bash
npm install --include=dev
npx prisma migrate deploy
npm run db:seed          # creates the first administrator (SEED_ADMIN_PASSWORD)
npm run build
npm run start:api        # Express API on API_PORT (4000)
npm run start:web        # Next.js on 3000
npm run worker           # background job drainer (separate process)
```

## Reverse proxy

- Route `/api/v1` to the API process; everything else to the web process.
- Terminate TLS here and forward `X-Forwarded-*`.
- Set a Content-Security-Policy at this tier (the API is JSON-only).

## Background jobs

Every unit of work is bounded. Either run `npm run worker`, or point a scheduler
at `POST /api/v1/jobs/run` with `Authorization: Bearer $CRON_SECRET`.

## Backups & recovery

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
psql "$DATABASE_URL" < backup-YYYY-MM-DD.sql
```

Exports live under `storage/exports/` (outside any public folder) and can be
safely deleted. Initial admin provisioning: run the seed with
`SEED_ADMIN_PASSWORD` set.

## Optional Docker

`docker-compose.yml` starts PostgreSQL + the API + the web app. It is a
convenience only; the default path needs just Node and PostgreSQL.

## Never

- Never commit a real `.env` or production credentials.
- Never use a default administrator password in production.
