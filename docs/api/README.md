# API reference (`/api/v1`)

All routes are JSON. Authentication is a session cookie (`pe_session`).
Mutating requests require the `x-csrf-token` header matching the `pe_csrf`
cookie. Errors use one envelope:

```json
{ "error": { "code": "forbidden", "message": "شما به این بخش دسترسی ندارید.", "details": [] } }
```

Success is wrapped as `{ "data": ... }`. `401` = not signed in, `403` = signed in
but not permitted (or missing CSRF), `404` = not found **or out of scope**,
`422` = validation.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/health` | — | status + db |
| GET | `/auth/csrf` | — | issues the CSRF cookie |
| POST | `/auth/login` | — | rate-limited; identical error for bad email/password |
| POST | `/auth/logout` | — | deletes the session row |
| GET | `/auth/me` | session | user, roles, permissions, employee, org |
| POST | `/auth/password` | session | change + revoke other sessions |
| POST | `/auth/password/request` | — | no enumeration |
| POST | `/auth/password/reset` | — | single-use token |
| PATCH | `/auth/profile` | session | name/phone only |
| GET/PUT | `/auth/consent` | session | consent categories |
| GET/POST | `/users` | `users.view` / `users.create` | org-scoped |
| PATCH | `/users/:id` | `users.edit` | can't disable self |
| GET | `/roles`, `/roles/permissions` | `roles.view` | catalog + roles |
| POST/PATCH/DELETE | `/roles` | `roles.manage` | protected role refused |
| GET/POST/PATCH | `/organization/units`, `/positions` | `organization.*` | |
| GET/POST/PATCH | `/employees` | `employees.*` | lists are data-scoped |
| POST | `/employees/:id/manager-history` | `employees.manage_info` | effective dates |
| GET/POST/PATCH | `/questions`, `/questions/categories` | `questions.*` | edits mint a version |
| GET/POST | `/forms`, `/forms/:id/versions` | `forms.view/create/edit` | |
| POST | `/forms/versions/:vid/publish` | `forms.publish` | freezes the version |
| POST | `/forms/versions/:vid/preview` | `forms.view` | server-side scoring preview |
| GET/POST/PATCH | `/evaluation-cycles` | `cycles.*` | |
| POST | `/evaluation-cycles/:id/status` | `cycles.edit` | transition-validated |
| GET/POST | `/evaluation-cycles/:id/assignments` | `assignments.*` | bulk assign |
| GET | `/evaluation-cycles/:id/dashboard` | `cycles.view` | completion stats |
| GET | `/evaluations` | `evaluations.view_own` | my assignments |
| GET | `/evaluations/:id` | evaluator or `evaluations.view_raw` | |
| PUT | `/evaluations/:id/responses` | `evaluations.fill` | draft save |
| POST | `/evaluations/:id/submit` | `evaluations.submit` | validates required |
| POST | `/evaluations/:id/review` | `evaluations.review/approve/return` | |
| POST | `/evaluations/:id/reopen` | `evaluations.reopen` | reason required |
| POST | `/evaluations/publish` | `evaluations.publish` | blocks incomplete |
| GET | `/evaluations/results/list` | `reports.view` | scoped results |
| GET/POST | `/evaluations/appeals*` | `appeals.*` | |
| GET/POST/PATCH | `/improvement-plans` | `improvement_plans.*` | |
| GET/POST | `/compensation/policies` | `compensation.policies_*` | |
| GET/POST | `/compensation/recommendations` | `compensation.*` | recommendation only |
| POST | `/compensation/recommendations/:id/decision` | `compensation.approve` | records decision |
| POST/GET | `/reports/exports`, `/reports/exports/:id/download` | `reports.*` | background + expiring |
| GET/POST | `/reports/imports/template`, `/imports/preview`, `/imports/confirm` | `imports.manage` | |
| GET/POST/PATCH/DELETE | `/ai/providers`, `/ai/models`, `/ai/use-cases` | `ai.manage` | keys never returned |
| POST | `/ai/chat`, GET `/ai/conversations` | `ai.use` | gated by use-case policy |
| GET | `/help`, `/help/article/:slug`, `/help/search` | public | published content |
| POST/PUT | `/admin/settings`, `/admin/compliance`, `/admin/third-party` | `settings.manage` / `compliance.manage` | |
| GET | `/admin/audit`, `/admin/overview`, `/admin/security/overview` | `audit.view` / `settings.view` | |
| POST | `/jobs/run` | bearer `CRON_SECRET` or `jobs.manage` | drains the queue |

Rate limits: login (8 / 5 min / IP), password reset (5 / 15 min), AI (20 / min),
exports (30 / 10 min), uploads (20 / 10 min).
