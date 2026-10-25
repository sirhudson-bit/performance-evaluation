# سامانه ارزیابی عملکرد کارکنان

Persian-first, RTL, enterprise performance-evaluation platform. Monorepo with a
standalone Express API, a Next.js web app and a background worker, backed by
PostgreSQL via Prisma.

> **Resuming work?** Read `docs/CHANGE-REPORT.md` first — it records what was
> built, what was verified, and what remains unresolved.

---

## Architecture

```
apps/web   Next.js 15 (App Router, RSC) ──┐  browser talks only to this origin
                                           │  (/api/v1/* is proxied to the API)
apps/api   Express + TypeScript, /api/v1 ──┤  sessions, RBAC, data-scope, scoring
apps/worker drains the DB-backed job queue ┘  (exports, imports, reminders)
packages/shared       types, permission catalog, PURE scoring engine
packages/validation   shared Zod schemas (client + server)
packages/ui           design tokens + class merge
database/             Prisma schema, migrations, seed
storage/              generated exports (outside any public folder)
tests/  docs/  scripts/
```

Key structural rules the code enforces:

1. **Authorization is server-side.** Hiding a UI element is never the control;
   every protected route re-checks a permission and the caller's data scope.
2. **A manager is not a superuser.** Visibility comes from the organizational
   relationship (`employee_manager_history`), not from the role.
3. **Cross-organization reads resolve to 404**, never 403, so an id never
   confirms that a foreign record exists.
4. **The browser never sees a secret.** AI provider keys are encrypted at rest
   and never returned to the client.
5. **Scoring is deterministic and pure.** The frontend is never authoritative.

## Requirements

- Node.js 20+ (developed on 24)
- PostgreSQL 14+
- npm

## Setup

```bash
npm install --include=dev        # see the NODE_ENV note below
cp .env.example .env             # fill DATABASE_URL, APP_KEY, CRON_SECRET
npx prisma migrate deploy        # or `npm run db:migrate` while developing
npm run db:generate
npm run db:seed                  # permissions, roles, admin, demo org + form
```

`APP_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Seeded development logins

| Role | Email | Password |
|---|---|---|
| System admin | `admin@performance.test` | `AdminDev!2026` |
| HR manager | `hr@performance.test` | `AdminDev!2026` |
| Manager | `manager@performance.test` | `AdminDev!2026` |
| Employee | `employee@performance.test` | `AdminDev!2026` |

The seed password comes from `SEED_ADMIN_PASSWORD`; if it is unset the seed
generates a random one and prints it once. Demo data is created unless
`SEED_DEMO_DATA=false`.

> **NODE_ENV trap.** This machine exports `NODE_ENV=production` globally. Two
> consequences: use `npm install --include=dev` (otherwise devDependencies are
> skipped), and never run `next dev` directly — the web `dev` script
> (`apps/web/scripts/dev.cjs`) forces `NODE_ENV=development` for you. Skipping
> both is the usual cause of "everything renders broken / bare 500s".

## Run

### Fresh clone (once)

```bash
npm install --include=dev     # installs deps and auto-generates the Prisma client
npm run setup                 # generate + migrate + seed (creates the demo data)
```

### Every day

```bash
npm run dev
```

That single command is **self-healing** (`scripts/dev.cjs`). Before starting the
servers it:

1. generates the Prisma client if it is missing (the usual cause of
   *"Prisma fails to load or execute"*);
2. starts the local PostgreSQL cluster (`.pgdata`, port **55433**) if it is not
   running — no need to start the database by hand;
3. applies pending migrations (idempotent);
4. starts the API (`:4000`) and the web app (`:3000`).

Then open **http://localhost:3000** and sign in with a demo login above. The
landing page is always at `/`; a signed-in visitor gets a direct link to the
dashboard.

Other scripts:

```bash
npm run dev:api        # just the API
npm run dev:web        # just the web app (forces NODE_ENV=development)
npm run worker         # background job drainer
npm run db:seed        # re-seed demo data
npm run db:studio      # Prisma Studio
```

**Why is this different from the other projects?** The others are a single
Next.js app, so `npm run dev` = `next dev`. This one is a monorepo (a separate
Express API + the Next.js app + Prisma), so it additionally has to generate the
Prisma client and have PostgreSQL running and migrated. `scripts/dev.cjs` does
all of that for you.

Stopping / stuck ports:

```powershell
# Ctrl+C in the npm run dev window normally stops everything.
# If a stray process still holds a port:
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Manual database start (if you prefer to run PostgreSQL yourself):

```bash
"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D ".pgdata" -o "-p 55433" -l ".pgdata\server.log" start
"C:\Program Files\PostgreSQL\16\bin\pg_isready.exe" -h 127.0.0.1 -p 55433
```

The web app proxies `/api/v1/*` to `http://127.0.0.1:4000` (override with
`API_URL`). In production, route `/api/v1` to the API at the reverse proxy.

## Verify & test

```bash
npm run typecheck      # tsc across every workspace
npm test               # vitest unit tests (scoring engine, …)
npm run build          # build the API typecheck + the web app
BASE_URL=http://127.0.0.1:4000 node scripts/verify.cjs   # 34 real HTTP checks
```

The verify harness drives a full journey against a running API: login → RBAC
denial → cycle creation → assignment → manager & self fill/submit → HR approve →
publish → score → Excel export & download → AI gating → CSRF → 404 scoping.

## Where the pieces are

- Scoring engine: `packages/shared/src/scoring.ts` (documented formulas).
- Permission catalog: `packages/shared/src/permissions.ts`.
- Workflow state machines: `packages/shared/src/workflow.ts`.
- API modules: `apps/api/src/modules/*`.
- Data scope: `apps/api/src/middleware/scope.ts`.
- Legal / privacy pages: `apps/web/src/app/{privacy,terms,cookies}`.

## Deployment

See `docs/deployment/deployment.md`. Docker Compose is provided as an
**optional** convenience; the default path needs only Node and PostgreSQL.

## License notes

Third-party asset and license inventory: `LICENSES/README.md`. The Persian UI
font is Vazirmatn (SIL OFL 1.1).
