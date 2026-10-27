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




---

## Session 8 — credentials, per-person reports, option editing, responsive audit

Reported: super-admin password creation/reset, a per-person performance report,
add/remove/edit question options, and forms/pages breaking when the viewport
changes. All four were implemented and verified in a real browser and over HTTP.

### 1. Super-admin password controls

- **Create user with a password.** The create form shows «رمز عبور» + «تکرار رمز»
  only to the platform super administrator (`settings.manage`). Leave them empty
  and the API still generates a one-time password as before.
- **Set/reset a password directly** (`POST /users/:id/password`) — super-admin
  only, validated by `userSetPasswordSchema` (≥8 chars, letter + digit), hashed
  with bcrypt (12 rounds), audited as `user.password_set`, and **all target
  sessions are revoked** so a compromised login cannot survive the reset.
- The existing single-use email **reset link** remains available for other
  administrators; it never reveals the current password.
- Server-side guard is independent of the UI: an HR account with `users.edit`
  receives **403** from the new endpoint (verified with a real HR session).

### 2. Per-person performance report

- `GET /reports/employees` — scoped directory (self + current/historical reports,
  or everyone with `employees.view_all`), searchable by name/employee number,
  with each person's latest score/cycle/status.
- `GET /reports/employees/:id` — full record: identity, summary KPIs, every
  cycle result, evaluator/section breakdown of the latest result, assignment
  states, agreements with indicator progress, improvement plans and appeals.
  Foreign/out-of-scope ids resolve to **404** (verified against a manager
  session: employee 1 → 404, their own reports → 200).
- UI: `/reports/employees` and `/reports/employees/[id]`, with a «چاپ / ذخیره
  PDF» button and print stylesheet. Linked from `/reports`, `/results` and each
  row of `/admin/users` (when the account is linked to an employee).

### 3. Question options

- The create form now supports **add + edit + delete** for each option, with a
  responsive per-option grid and an explicit delete action (the last one cannot
  be deleted accidentally).
- New `/admin/questions/[id]` editor pre-fills the question and its options;
  saving uses the existing `PATCH /questions/:id`, which mints a new immutable
  question version — deleting/editing an option never changes historical forms
  or scores. Stable keys are read-only in edit mode.
- Verified over HTTP: created a 3-option question, edited one option and removed
  another → `v2` with exactly the two retained/edited options; archived the test
  question afterwards.

### 4. Responsive defects — actual causes and fixes

Measured with a real browser at **320 / 390 / 500 / 768 / 1024 / 1440 px** on 20
authenticated routes.

1. **Every mobile page scrolled sideways.** The sidebar drawer was a `fixed`
   element kept mounted and moved off-screen with `translate-x-full`. On mobile
   that widened the layout viewport (measured 669 px at a 390 px viewport),
   which also inflated fixed overlays (the guided tour measured 669 px wide).
   Fixed by removing the closed drawer from layout (`hidden lg:block`) and
   adding `overflow-x-clip` to the shell.
2. **Forms were too narrow on 1024–1279 px.** 16 pages used
   `lg:grid-cols-3`; with the 288 px sidebar the form column was ~213 px wide.
   Those grids/col-spans now switch at `xl` (1280), so 1024 px gets a full-width
   single column and 1280+ keeps the intended three columns.
3. **Cards/tables could force the page wider than the viewport.** Cards are now
   `min-w-0`, and the horizontal table wrapper is `max-w-full`, so wide tables
   scroll inside their card instead of stretching the page.
4. **Floating tip overflowed a 320 px viewport.** It is now inset on mobile
   (`inset-x-3` + `sm:max-w-xs`) instead of a fixed 20rem box.
5. Header/actions are `min-w-0` / `flex-wrap`; long org names truncate rather
   than push the theme/help controls.

Post-fix result: `scrollWidth - clientWidth = 0` on all 20 routes at every tested
width, and the tour/tip overlays fit inside 320 px and 390 px viewports.

### Verification

- `npm run typecheck` (api + web) clean; `npm run lint` 0 warnings;
  `npm test` → **22/22**.
- `npm run build -w @pe/web` compiles with the new routes
  (`/reports/employees`, `/reports/employees/[id]`, `/admin/questions/[id]`).
- Real HTTP: chosen password at create → login 200; password reset → old
  password **401**, new password **200**, sessions revoked; HR password-set
  **403**; question option edit/delete → `v2`; per-person report scoping 404/200.
- Real browser: users/questions/report pages render at phone and desktop widths;
  no horizontal overflow; tour and tip cards stay inside the viewport.

### Limits worth knowing

- Option editing follows the `questions.edit` permission (HR normally holds it
  too); the **password** controls are strictly platform-admin (`settings.manage`).
- The per-person report shows data from published/persisted results; a person
  with no results gets explicit empty states rather than a blank page.
- The demo database contains repeated test cycles (from earlier verification
  runs), so the sample report's trend has duplicates; production data is unaffected.

## Session 9 — password visibility, credential error UX, SMS/OTP

### What changed

1. **Password visibility everywhere.** New `PasswordInput` wraps the field with
   an eye button (`type="button"`, `aria-pressed`). Used in login, create user,
   direct password set, profile change, reset-password, AI keys and SMS panel
   password. The eye never submits the form.
2. **422 errors explain themselves.** `apiClient` now prefers the first Zod field
   message (e.g. «رمز عبور باید حداقل ۸ نویسه باشد») over the generic
   «داده‌های ورودی معتبر نیست». Create/reset password forms validate with the
   shared schema before submitting and disable the save button until the password
   is valid and matches the confirmation. This removes the blank/too-short submit
   path that produced the original generic error.
3. **MeliPayamak settings.** `/admin/sms` (linked from `/admin/settings`) stores
   `sms_*` settings per organization. The panel password is encrypted with
   `APP_KEY` and never returned; an empty password on save keeps the stored one.
   Includes sender line, base URL, OTP template, optional service-pattern
   `bodyId`, a test send, delivery log, and documentation link.
4. **OTP login.** `/auth/otp/request` and `/auth/otp/verify`, with a new
   `login_otps` table. Codes are 6 digits, valid 2 minutes, single use, hashed
   with HMAC-SHA256 keyed by `APP_KEY`, capped at 5 attempts and rate-limited.
   Unknown emails get the same generic response. The login page has a tab for it.
5. **System SMS.** `/admin/sms/send` sends to all users, managers, staff or one
   user (max 200 per batch, 4 concurrent). Every attempt is written to
   `sms_messages`; OTP bodies are redacted from the log. Also adds the previously
   missing `/forgot-password` and `/reset-password` pages so reset links work.

### Verification

- `npm run typecheck` (api + web), `npm run lint` (0 warnings), `npm test` → 30/30.
- Mock MeliPayamak provider on `127.0.0.1:4599`: settings save encrypted; test SMS
  reached the mock with the expected form payload; bulk send 1/1; OTP request sent
  a code, verify created a session, replay was rejected, `/auth/me` returned 200.
- Real browser: `/admin/sms` renders settings/composer/logs; eye toggles
  `password`→`text`; short password shows «حداقل ۸ نویسه» and disables save; OTP
  tab sent a code, accepted it and landed on `/dashboard`; forgot/reset pages
  render; 0 overflow at 320/390 px.
- Test phone numbers and the demo password were restored; SMS settings were left
  disabled with no sender/username. Delivery-log rows from the mock test remain in
  the local demo database (they are not visible to production users).

### Notes

- SMS delivery requires the account's mobile number; users without one cannot
  use OTP and are skipped by bulk sends.
- The panel's `BaseServiceNumber` (pattern) mode expects only the variable value;
  when `bodyId` is configured the API sends the raw code rather than the rendered
  template.

## Session 10 — resend countdown, SMS window, phone at user creation

### What changed

1. **OTP resend countdown.** After a code is requested the login form shows
   `ارسال دوباره در mm:ss` (Persian digits, updates every second) and only
   reveals the resend button at zero. The timer uses a single timeout per tick
   and is announced with `aria-live="polite"`.
2. **SMS time window.** `/admin/sms` now has an optional daily window
   (`windowEnabled`, `windowStart`, `windowEnd`, default 08:00–20:00 Tehran).
   Bulk/system sends outside the window are rejected with a clear message;
   overnight ranges (e.g. 20:00–08:00) are supported. OTP login and the test
   button deliberately bypass the window so nobody is locked out at night.
   The API enforces the window in both the bulk route (fast, clear error) and
   the shared `sendSms` function (defence in depth).
3. **Phone at user creation.** `userCreateSchema`, the create-user API and the
   admin «افزودن کاربر» form now accept an optional mobile number, so OTP and
   SMS work without a second edit. Edit-user already had the field.

### Verification

- `npm run typecheck` (api + web + worker), `npm run lint`, `npm run build`
  clean; `npm test` → **36/36** (new window/URL cases).
- Local mock provider: OTP request still sends outside the window; bulk send
  outside 08:00–09:00 returned the expected 400 message; countdown measured
  `۰۰:۵۹` → `۰۰:۵۶` and the resend button stayed hidden.
- Browser at 320/390 px: `/login`, `/admin/users`, `/admin/sms` have zero
  horizontal overflow; the phone and time-window controls render.
- Test phone restored and SMS settings disabled after verification.
