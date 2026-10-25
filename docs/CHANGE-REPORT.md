# Change report

New project created at `C:\Users\Pc\performance-evaluation`. This document
states what was built, what was verified, and what remains unresolved. Nothing
is marked complete that was not run.

## What was built

- **Monorepo**: `apps/web` (Next.js 15 App Router, RSC, RTL), `apps/api`
  (Express + TS, `/api/v1`), `apps/worker` (DB-backed job drainer),
  `packages/{shared,validation,ui,config}`, `database/`, `tests/`, `docs/`,
  `scripts/`, `storage/`.
- **Database** (`database/schema.prisma`, migration `…_init`): ~50 models —
  organization units/positions/employees/manager-history, users/sessions/reset
  tokens, roles/permissions, question bank + immutable versions, forms +
  versioned sections/questions, scoring-policy versions, workflows, periods,
  cycles, assignments, responses, scores, final results, reviews, appeals,
  improvement plans, compensation policies/recommendations/approvals, AI
  providers/models/use-case policies/usage/conversations, audit logs,
  notifications, settings, compliance profile, third-party register, consent,
  import/export jobs, jobs queue, help content, assets.
- **API modules**: auth, users, roles, organization, employees, questions,
  forms, cycles (+assignments/dashboard), evaluations (+results/appeals/
  improvement plans), compensation, reports (exports/imports), ai, help, admin
  (settings/compliance/third-party/assets/audit/security/overview), jobs, health.
- **Pure scoring engine** with documented formulas, Decimal arithmetic,
  weight validation, N/A handling, no silent weight redistribution, policy
  versioning.
- **Web app**: 29 routes — landing, login, app shell, dashboard, profile,
  evaluations (list + fill/submit), team, results, appeals, improvement plans,
  compensation, reports (export UI), AI assistant, help, legal pages
  (privacy/terms/cookies), and admin (users, roles, organization, questions,
  forms, cycles, AI, compliance, settings, audit).
- **Seed**: permissions (67), 5 default roles, admin + demo org/hierarchy/users,
  a published evaluation form, help content, asset/license inventory.
- **Docs**: README, scoring, security audit, accessibility, legal readiness,
  data inventory, deployment, requirements traceability, this report.

## Why each major choice was made

- **Separate Express API + Next.js** — per the master prompt and the stated
  architecture preference; the browser only talks to the Next origin
  (`/api/v1` proxied), keeping the session cookie same-site.
- **DB-backed job queue (no Redis)** — durable, and keeps the project runnable
  without Docker/Redis (Redis/BullMQ is an optional future adapter).
- **`decimal.js` for scoring** — avoids float error in published scores.
- **`employees.view_all` permission** — separates "sees every employee" from
  scoped manager access (a manager's role alone must not grant everything).

## Tests executed (real results)

- `npm test` → **15/15** unit tests pass (scoring engine).
- `node scripts/verify.cjs` → **34/34** end-to-end HTTP checks pass against the
  running API, including a full cycle whose published score was **72.53**.
- `npm run build -w @pe/web` → **29 routes** built successfully.
- `tsc` typecheck passes for `packages/shared`, `packages/validation`,
  `apps/api`, `apps/worker`.

## Environment notes

- The project uses a **dedicated PostgreSQL cluster** created for it on port
  **55433** (data dir `performance-evaluation/.pgdata`, git-ignored) because the
  existing instances on this machine did not accept the known credentials. The
  existing clusters were left untouched.
- This machine exports `NODE_ENV=production` globally; `npm install` must be run
  with `--include=dev`, and the API's `.env` is made authoritative for local
  development.

## Unresolved / not built (honest list)

1. **GapGPT endpoints/models are unverified** — the provided docs URL is a
   JavaScript SPA with no API reference. Shipped as a configurable
   `openai_compatible` adapter marked *not configured* until a key + real docs
   are supplied; the offline adapter works today.
2. **Business/legal identity** is `[REQUIRES BUSINESS CONFIRMATION]` and is a
   production-readiness blocker (entered via the admin compliance panel).
3. **No legal compliance, penetration test, production deployment, or load/
   throughput claim** is made — each requires counsel / an authorized
   environment / real infrastructure and load tests.
4. **UI gaps**: no interactive drag-and-drop form builder canvas, no guided-tour
   overlay, no consent banner component, and several admin screens are
   list-based without their full editors (compensation approval, appeal
   submission, improvement-plan editor, role editor, question builder form is
   basic).
5. **Accessibility**: no axe-core scan was run and no screen-reader walkthrough
   was performed; only manual keyboard/focus checks.
6. **`npm audit`**: findings remain. They were **reviewed, not blindly fixed** —
   `--force` would bump deliberately pinned packages (`next`, `prisma`). No
   regressive change was made to silence an advisory.
7. **Uploads**: type/size/parse limits only; no AV scanning.
8. **SMTP**: optional; when unset, mail is logged and the UI says so.

## Required next actions (and owner)

| Action | Owner |
|---|---|
| Enter business identity + jurisdictions + retention | Business owner (admin panel) |
| Confirm GapGPT capabilities; provide key | Business owner / provider docs |
| Run axe + screen-reader audit | Dev team |
| Penetration test + load test on an authorized env | Security/infra |
| Build the remaining UIs listed in §4 | Dev team |
| Legal review of policy/terms | Qualified counsel |

---

## Session 2 — feature additions

Fourteen requested changes were implemented and verified.

| # | Request | What was built | Where |
|---|---|---|---|
| 1 | Department / work-unit field for users | `User.departmentId` → `organization_units`; assignable by admin/HR; shown in profile and the shell | schema, `modules/users`, `AdminForms.UserForm/UserEditForm` |
| 2 | Admin can add/edit roles | Custom role create + permission-matrix editor | `modules/roles`, `components/RoleForm.tsx`, `/admin/roles` |
| 3 | Admin can add/edit org units & job titles | Create/edit forms for units and positions | `modules/organization`, `components/OrgForms.tsx`, `/admin/organization` |
| 4 | Light/dark toggle | Class-based dark mode, persisted to localStorage **and** the profile; no-flash init script; dark variants across the design system | `tailwind.config`, `globals.css`, `ui.tsx`, `ThemeToggle.tsx`, `layout.tsx` |
| 5 | Messaging / ticketing | `SupportTicket` + `TicketMessage`; create, thread, reply, status/assign; staff scope | `modules/tickets`, `components/TicketForms.tsx`, `/tickets`, `/admin/tickets` |
| 6 | Report graphs/charts | Analytics endpoint (score distribution + status) + Recharts bar/pie | `modules/reports` (`/analytics`), `components/ReportsCharts.tsx` |
| 7 | Admin & HR edit user info | Extended `PATCH /users/:id` (name, email, phone, status, department, roles) + inline editor | `modules/users`, `AdminForms.UserEditForm`, `/admin/users` |
| 8 | Minimalist landing | Feature overview + dashboard access (signed-in users pass straight through) | `app/page.tsx` |
| 9 | PWA + admin web-app settings | `manifest.ts` (reads admin settings), service worker, register component, icon; PWA settings group (name, names, colors, display, orientation, install prompt, offline) | `app/manifest.ts`, `public/sw.js`, `public/icon.svg`, `ServiceWorkerRegister.tsx`, `AdminForms.SettingsForm` |
| 10 | Comprehensive step-by-step tutorial | 19 seeded help articles covering every module + 6 guided tours targeting real elements | `seeds/seed.ts`, `components/tours.tsx`, `/help`, `/admin/help` |
| 11 | Floating reminders/tips | Rotating, dismissible tips inside the app | `components/FloatingTips.tsx`, `Shell.tsx` |
| 12 | All dates in Jalali | `JalaliDateInput` (Persian y/m/d) replaces the Gregorian date inputs; display already Jalali everywhere | `components/JalaliDateInput.tsx`, `AdminForms.CycleForm` |
| 13 | Admin & HR create/edit/delete forms | Form create + new-version + publish + delete/archive | `modules/forms` (`DELETE /forms/:id`), `AdminForms.FormCreateForm`, `/admin/forms` |
| 14 | Admin & HR create/edit/delete improvement plans | CRUD + editor | `modules/evaluations` (`DELETE`), `ImprovementPlanForms.tsx`, `/improvement-plans` |
| 15 | Managers propose rewards/salary, approved by admin/HR | Proposal create + edit (PATCH) by the manager; approve/reject by admin/HR; HR granted `compensation.approve` | `modules/compensation`, `CompensationForms.tsx`, `/compensation` |

**Schema migration:** `20261013152429_departments_tickets_theme` (User.departmentId, User.themePreference, `support_tickets`, `ticket_messages`). Two permissions added (`tickets.view`, `tickets.manage`; now 69 total).

### Verification (re-run, real results)

- `node scripts/verify.cjs` → **59/59** checks pass, including the new: public PWA config, theme persistence, department set/read, role create/edit, unit create/edit, job-title create, ticket create/reply/staff-reply/close + employee denied (403), analytics distribution, form create/delete, improvement-plan create/delete, and compensation proposal → edit → manager denied approval (403) → HR approval.
- `npm test` → **15/15** unit tests pass.
- `npm run build -w @pe/web` → **33 routes** build (incl. `/tickets`, `/admin/tickets`, `/manifest.webmanifest`).
- `eslint .` → clean (0 warnings).

### Notes / limits

- The service worker caches only static same-origin assets and never API responses; navigations bypass the HTTP cache so a deployment is never masked.
- The PWA icon is an SVG; a PNG maskable set is recommended before an app-store-style listing.
- Guided tours highlight elements by `data-tour` attribute; a step whose target is absent on the current page is skipped (never points at nothing).
- No new unresolved security items were introduced; the earlier open items in this report still stand.

---

## Session 3 — defect fixes (hydration, visuals, landing, launcher)

Reported: a hydration mismatch warning, visual/UX problems, "no landing page",
and a problematic batch file. Diagnosed in a **real browser** (agent-browser +
Chrome) rather than by assumption.

### Root causes found

1. **Bare `500`s / broken pages (the "visual issues").** This machine exports
   `NODE_ENV=production` globally; `next dev` inherited it and served
   production-like output, returning plain `Internal Server Error` on every
   route. Fixed with `apps/web/scripts/dev.cjs`, which forces
   `NODE_ENV=development` before starting Next (the same pattern the API's
   `.env` already uses). The web `dev` script now points at it.
2. **Corrupted `.next`.** Running `next build` while `next dev` was live (which I
   did during verification) corrupted the shared `.next` directory and produced
   an unstyled page plus a `Cannot find module './NNN.js'` runtime overlay.
   Resolved by stopping dev, deleting `.next`, and restarting. Documented below.
3. **Dark-mode contrast defects.** The login card used `bg-surface` with no dark
   variant (white card with dark inputs), and several headings/body texts
   (`text-slate-900/800/700`) had no dark variant → invisible or low-contrast in
   dark mode (e.g. the login title, legal/help/assistant text). Fixed with
   `dark:` variants across those files plus a scoped `html.dark` contrast safety
   net in `globals.css`.
4. **Charts unreadable in dark mode.** Recharts used its default dark-grey axis
   and white tooltip. Fixed in `ReportsCharts.tsx`: themed axis/grid/tooltip
   colours, Persian-digit axis ticks, and a legend instead of overlapping pie
   labels.
5. **Hydration warning.** Could not be reproduced in a clean browser (no console
   error on landing, dashboard, cycles, reports, help, tickets or audit pages,
   in light or dark mode). The message the user quoted matches the well-known
   **browser-extension attribute injection** on `<body>` (e.g. `cz-shortcut-listen`
   from ColorZilla/Grammarly). The standard, correct remedy was applied:
   `suppressHydrationWarning` on `<body>` (in addition to `<html>`, already
   present for the pre-hydration theme class).
6. **"No landing page".** The landing page existed at `/` but redirected
   signed-in users straight to `/dashboard`, so it was never seen. Now `/`
   **always** renders the landing; a signed-in visitor gets a "رفتن به داشبورد"
   button instead of a redirect.

### Files changed

- `apps/web/scripts/dev.cjs` (new), `apps/web/package.json` (dev script).
- `apps/web/src/app/layout.tsx` (body `suppressHydrationWarning`).
- `apps/web/src/app/page.tsx` (landing always visible).
- `apps/web/src/app/login/page.tsx` (dark card + readable title).
- `apps/web/src/components/ReportsCharts.tsx` (theming, Persian digits, legend).
- `apps/web/src/styles/globals.css` (dark contrast safety net).
- Dark variants added in: `LegalShell.tsx`, `privacy|terms|cookies` pages,
  `help/page.tsx`, `assistant/page.tsx`, `EvaluationForm.tsx`.

### Launcher (batch file)

`run.bat` and `stop.bat` were **deleted** as requested. Running the project is
now the standard, transparent flow — database first, then `npm run dev` — with
the exact commands and port-cleanup steps documented in `README.md` (Run
section). The one caveat the batch encoded (start the DB, force
`NODE_ENV=development`) is now handled by `dev.cjs` and documented, so a
launcher is no longer needed.

### Verification (re-run after the fixes)

- `npm run build -w @pe/web` → compiled successfully.
- `tsc` (api + packages) → clean; `eslint . --max-warnings=0` → clean.
- `npx vitest run` → 15/15.
- `node scripts/verify.cjs` → 59/59.
- Browser (Chrome via agent-browser): `/`, `/login`, `/dashboard`, `/reports`,
  `/help`, `/admin/cycles`, `/tickets`, `/admin/audit` all render; **no console
  errors and no hydration warning** in light or dark mode; charts themed.

---

## Session 4 — UX fixes, wizard, pagination, performance

Reported: header in the wrong place, org name not updating, Users/Question-Bank
pages erroring, need for a create wizard, menu consolidation, audit "clear",
pagination/AJAX, animations, and general sluggishness. All reproduced in a real
browser and fixed.

### Root causes & fixes

1. **Header on the side instead of the top.** The app shell was a single
   `lg:flex` row, so the header became a flex *column*. Restructured to a
   top-level column: full-width sticky header, then a row with sidebar + main.
2. **Stale UI + "client-side exception" (the biggest one).** The PWA service
   worker cached `/_next/*` chunks **cache-first**, so after any rebuild the
   browser ran *old* JavaScript against *new* server HTML — yielding hydration
   errors, broken pages and a stale menu. Fixed: the worker is now registered
   **production-only**, never caches `/_next/` or the API, and in development it
   proactively unregisters any existing worker and clears its caches. This also
   explains the intermittent hydration warnings.
3. **Users & Organization pages threw.** Both passed a **render function** from
   a Server Component to a Client Component (`InlineEditor render={…}`), which
   RSC forbids. Replaced with proper client row-action components
   (`UserRowActions`, `UnitRowActions`, `PositionRowActions`) that receive only
   serializable props and own their open/close state.
4. **Org name not reflecting settings.** The header/sidebar showed the raw org
   name. It now reads `organization_display_name` from settings (via
   `/public/config`), and saving settings calls `router.refresh()`, so the
   header updates automatically.
5. **Create wizard.** New `/admin/wizard` with a 4-step **form** wizard (info →
   sections → questions → review/publish) and a 3-step **cycle** wizard (info →
   evaluators/weights → create+activate+assign), using a stepper and Jalali date
   inputs. Linked as «ویزارد ایجاد» in the menu.
6. **Menu consolidation.** Groups reduced to three clear sections: «کارهای من»,
   «مدیریت ارزیابی», «مدیریت سامانه».
7. **Audit "Clear" button.** `DELETE /api/v1/admin/audit/clear?days=30` (or
   `all=1`), gated by `settings.manage`; the clear action itself is audited.
   A confirm-guarded button was added to the Event Logs page.
8. **Pagination instead of long scrolls.** `Pagination` component (server-side,
   soft-navigation links so it behaves like AJAX) on the Users and Event Logs
   lists (25/page), plus a `loading.tsx` skeleton for instant feedback.
9. **Animations.** Subtle `fade-in`/`slide-up` keyframes for route content and
   wizard tabs, and `transition-colors` on nav links — all disabled under
   `prefers-reduced-motion`.
10. **Performance.** Added `optimizePackageImports: ['lucide-react','recharts']`
    (faster dev compile, smaller bundles), the loading skeleton, and the service
    worker fix above. The Question Bank page itself was fine (its earlier failure
    was the stale-worker/NODE_ENV state, not its code).

### Files

- Shell (`Shell.tsx`): header/layout, consolidated groups, org name, animation.
- `(app)/layout.tsx` + API `public/config`: org display name.
- `AdminForms.tsx` / `OrgForms.tsx` / users+organization pages: row actions.
- `ServiceWorkerRegister.tsx`, `public/sw.js`: worker scope + cache policy.
- New: `FormWizard.tsx`, `CycleWizard.tsx`, `WizardTabs.tsx`, `/admin/wizard`,
  `Pagination.tsx`, `(app)/loading.tsx`, `(app)/error.tsx`.
- `admin/routes.ts` (`/audit/clear`), audit & users pages, `tailwind.config.ts`
  (keyframes), `next.config.mjs` (optimizePackageImports).

### Verification

- Build compiles; `eslint --max-warnings=0` clean; **15/15** unit tests;
  **59/59** end-to-end checks.
- Real browser: `/admin/users`, `/admin/organization` and `/admin/wizard` all
  render (previously erroring), the header is a top bar, the menu shows the three
  consolidated groups with «ویزارد ایجاد», and the header shows the settings org
  name. No console errors.

---

## Session 5 — make `npm run dev` self-healing (fix "Prisma fails to load")

**Why this project runs differently from the others.** The other projects are a
single Next.js app, so `npm run dev` is just `next dev`. This one is a monorepo:
a separate **Express API**, the **Next.js** app, and **Prisma**. That means three
extra preconditions must hold before the servers can run — and previously
nothing enforced them:

1. the **Prisma client must be generated** (`node_modules/.prisma/client`);
2. **PostgreSQL must be running** (the local cluster on port 55433);
3. the **schema must be migrated**.

**Root cause reproduced.** With the generated client absent, importing
`@prisma/client` fails with:

```
SyntaxError: The requested module '@prisma/client' does not provide an export named 'PrismaClient'
```

i.e. exactly *"Prisma fails to load or execute"*. This happens after a plain
`npm install` (the `@prisma/client` postinstall is gated by npm's allow-scripts,
or devDependencies were skipped because this machine exports
`NODE_ENV=production`). A stopped database produces the same symptom at runtime.

**Fix — one self-healing command.** `npm run dev` now runs
`scripts/dev.cjs`, which before starting the servers:

- generates the Prisma client **if it is missing**;
- starts the local PostgreSQL cluster if it is not listening (removing a stale
  `postmaster.pid` first) and waits until it is ready;
- runs `prisma migrate deploy` (idempotent);
- starts the API and web servers.

Also added:

- `scripts/postinstall.cjs` + a `postinstall` script, so a plain
  `npm install --include=dev` leaves the client generated (tolerant — never
  fails the install);
- `npm run setup` for a fresh clone (install + generate + migrate + seed);
- `npm run dev:servers` keeps the raw `concurrently` runner available.

A Windows quoting bug in the first version of the runner (unquoted paths with
spaces under `shell: true`) was found and fixed, so the database actually starts.

**Verification (cold start, real).** From a clean slate — project processes
killed, **PostgreSQL stopped**, and the generated Prisma client **deleted** —
`npm run dev`:

- regenerated the Prisma client,
- started PostgreSQL on 55433,
- applied migrations,
- served the API (`health: ok`) and the web app (`200`),
- accepted a login (`admin@performance.test`).

`node scripts/verify.cjs` → **59/59** checks still pass.

**Files:** `scripts/dev.cjs` (new), `scripts/postinstall.cjs` (new),
`package.json` (`dev`, `postinstall`, `setup`, `dev:servers`), `README.md`
(rewritten Run section).

---

## Session 6 — admin capabilities + performance management modules

### Admin panel
- **Roles:** delete a custom role (UI button on `/admin/roles`; the protected
  role and roles in use are refused by the API).
- **Organizational structure:** delete units and positions. A unit/position that
  is in use (has employees or children) is archived to preserve history;
  otherwise it is deleted. New `DELETE /organization/positions/:id`.
- **Users:** delete (default archive; `?hard=1` deletes permanently, revoking all
  sessions) and **reset password** — the admin gets a single-use reset link
  (emailed when SMTP is configured); the existing password is never revealed.
  Guard-rails: an admin cannot delete themselves, and the last platform admin
  cannot be removed.
- **Evaluation Results:** `/results` now shows analytical charts alongside the
  list — score distribution, status, and **average score broken down by
  organizational unit and by position** (`/reports/analytics` extended with
  `byUnit`/`byPosition`).
- **Super-admin export:** a new `responses_by_user` report exports **raw answers
  grouped per employee** (question, answer, score, N/A). It is restricted to a
  platform administrator / settings manager (HR gets 403).

### Performance management modules (new)
1. **Processes** (`performance_processes` + `process_steps` +
   `process_dimensions`): define independent processes with an evaluation model,
   target groups, ordered operational steps each with an owner role and SLA, and
   dimensions each with a responsible party. UI at `/admin/processes`.
2. **Cycles**: cycles can link to a process (`processId`) and generate a
   **step schedule** from the process (`/evaluation-cycles/:id/steps/from-process`,
   with per-step due dates from the SLA and status). Evaluator↔evaluatee
   relations and result calculation already existed and are unchanged.
3. **Agreements** (`performance_agreements` + `agreement_indicators` +
   `agreement_entries`): individual agreements with indicators (target vs actual,
   weight, progress %), continuous progress updates, a completion state, and an
   event/feedback log. UI at `/agreements`.
4. **Forms — calculated (quantitative) indicators**: a form question can be
   marked `computed` with a `formula` (e.g. `quality * 0.6 + teamwork * 0.4`).
   A new **safe** formula evaluator (`packages/shared/src/formula.ts`, no `eval`,
   numbers + `- * /`, parentheses, identifiers) resolves such questions from the
   other answers' normalized scores, in both the builder preview and the real
   evaluation scoring. Unit-tested. Automatic aggregation was already provided
   by the scoring engine.
5. **Reporting & analysis**: a new **«عملکرد من»** page (`/my-performance`) with
   the employee's own results, agreements (with progress) and improvement plans;
   the results page serves as the cycle **scorecard** with breakdown charts; the
   existing reports area covers the analytical exports. (A dedicated manager
   "team dashboard" beyond the current dashboard tiles remains a known gap — see
   files/traceability.)

### Data, permissions, tests
- Migration `20261015111523_processes_agreements_cycle_steps`; four new
  permissions (`processes.view/manage`, `agreements.view/manage`); HR manages
  processes/agreements, managers manage their team's agreements, employees view
  their own.
- `tests/unit/formula.test.ts` (7 tests). `eslint --max-warnings=0` clean.
- `node scripts/verify.cjs` → **74/74** (15 new checks: role/unit/position
  delete, reset link, self-delete guard, process + step + dimension creation,
  agreement + indicator progress + log entry, responses-export authorization and
  download, per-unit analytics).

### Known gaps (honest)
- The **manager "team performance" dashboard page** and a dedicated standalone
  scorecard page are not built (the results page + dashboard tiles cover the
  substance); noted in the traceability matrix.
- Formula variables are bound to question **stable keys** and normalized scores;
  raw-value binding and per-question formula editing UI are not exposed in the
  builder yet (the API accepts `computed`/`formula` on a form question).

---

## Session 7 — dark-mode readability, AI service management, settings sections

### Dark mode (readability)
The previous "safety net" in `globals.css` used plain `html.dark .text-slate-900`
selectors. Because that out-specifies Tailwind's `dark:` utilities, it silently
overrode *deliberate* dark colours and, worse, did **not** cover the real
offenders: deep-navy brand text (`text-brand-700`) on a near-black background,
light-only surfaces (`bg-white`, `bg-slate-50/100`) and `text-slate-400`.

- Every safety-net selector is now wrapped in **`:where()`**, which contributes
  zero specificity — so a real `dark:` utility on the same element still wins and
  the net only fills the gaps (previously it was overriding them).
- Coverage extended: slate 950→400 text, **brand** text, emerald/amber/rose/sky
  accent text, `bg-white`, `bg-slate-50/100`, `border-slate-300`, dividers, and a
  legible `::placeholder`.
- Light mode is untouched (all rules stay scoped to `html.dark`).

### AI management — configured services
`PATCH`/`DELETE /ai/providers/:id` already existed server-side; the admin UI had
no controls. New `AiProviderActions` client component (per row):
- **set as default** (the API clears the flag on all other services — exactly one
  default is asserted in the test suite),
- enable/disable, **probe connectivity** (`/probe`, honest about unsupported
  `/models`), **edit** (name, type, base URL, fallback, new API key — blank keeps
  the existing key), **add a model**, and **delete**.

### Settings & PWA
- Settings are now **separate sub-sections** ("تنظیمات عمومی" and "اپلیکیشن
  نصبشو (PWA)"), each with its own save button. The API upserts only the keys it
  receives, so saving one section can never reset another.
- A **full-screen view** toggle expands the panel (native Fullscreen API with an
  in-page overlay fallback) for easier editing.
- The page moved from a narrow single column to a two-column layout with an
  "optional services status" panel.

### Verification
- `npm run lint` clean, `npm run build -w @pe/web` compiles.
- `scripts/verify.cjs` gained 7 checks for AI providers (create, create-as-default,
  set-default, exactly-one-default, edit, probe, delete) → **81/81**.
- The suite is now self-cleaning: it drops leftover AI providers at start-up, so
  the "AI is unconfigured (503)" assertion is no longer state-dependent.


