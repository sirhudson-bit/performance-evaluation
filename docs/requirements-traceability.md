# Requirements traceability matrix

Maps each major requirement area to its implementation, its test, and its
status. Status is honest: **done**, **partial**, or **not built**.

| Requirement | Implementation | Test / evidence | Status |
|---|---|---|---|
| Org hierarchy, positions, employees, manager history with effective dates | `database/schema.prisma`, `apps/api/src/modules/organization`, `.../employees` | verify: employee list scoped; seed creates hierarchy | done |
| Roles & fine-grained permissions (5 defaults + custom) | `packages/shared/permissions.ts`, `roles.ts`, `apps/api/src/modules/roles` | verify: 67 perms on admin; employee denied users (403) | done |
| Data-scope authorization (manager ≠ all) | `apps/api/src/middleware/scope.ts` | verify: manager `seesAll=false` | done |
| Cross-org read → 404 | `middleware/scope.ts` | verify: unknown id → 404 | done |
| Personal profile (self-service fields, no mass-assignment) | `modules/auth/routes.ts` (PATCH /auth/profile) | web `/profile`; not separately unit-tested | partial |
| Data minimization (no DOB/national id/address) | schema (fields absent) | `docs/privacy/data-inventory.md` | done |
| Question bank (categories, answer types, weights, options, versions) | `modules/questions`, `packages/shared/enums.ts` | seed creates 9 questions; web admin/questions | done |
| Form builder with versioning & immutability | `modules/forms`, `modules/questions/service.ts` | published version frozen; verify uses seeded published v1 | done (builder UI is list+create+publish; drag-reorder API exists but no visual builder) |
| Evaluation cycles (periods, workflow, deadlines, confidentiality) | `modules/cycles` | verify: create → activate | done |
| Assignments (self/manager/hr; manager history as-of) | `modules/cycles` (bulk assign) | verify: 2 assignments created | done |
| Workflow states + server-side transition validation | `packages/shared/workflow.ts`, `modules/evaluations` | transition guard in code; verify exercises submit/approve | done |
| Weighted scoring engine (pure, Decimal, documented) | `packages/shared/src/scoring.ts` | `tests/unit/scoring.test.ts` (15) | done |
| Scoring preview before publish | `modules/forms/service.ts`, `POST /forms/versions/:id/preview` | code present | done (no UI button yet) |
| Final results with breakdown + policy version | `modules/evaluations/service.ts` | verify: final score 72.53 published | done |
| Appeals (configurable, records decisions, never deletes original) | `modules/evaluations` appeal routes | web `/appeals` list | partial (submit/decide API done; UI is a list) |
| Improvement plans | `modules/evaluations` improvement-plans | web `/improvement-plans` | partial (list) |
| Compensation (recommendation / policy; never automatic payroll) | `modules/compensation` | web `/compensation`; note "no automatic action" | partial (list + API; no approve UI) |
| Excel import (template, preview, duplicates, confirm) | `modules/reports` imports | API implemented; not in verify | partial |
| Excel export (multi-sheet, formula-injection safe, background, expiring download) | `modules/reports`, `lib/excel.ts` | verify: export → drain → xlsx download | done |
| Role dashboards | `apps/web/src/app/(app)/dashboard` | builds; role tiles from `/admin/overview` | done |
| AI adapters (OpenAI-compatible / Gemini / offline), encrypted keys, gating | `lib/ai/*`, `modules/ai` | verify: disabled 503 → offline chat works; key masked | done |
| AI never decides; no eval data by default | `lib/ai/service.ts` (feature policy, help-only context) | verify: disclosure note asserted | done |
| Persian RTL, Vazirmatn, Jalali dates, Persian digits | `apps/web` layout, tailwind, `lib/format.ts` | web builds; format unit-tested indirectly | done |
| Help centre + FAQ + glossary + search | `modules/help`, web `/help` | endpoints + UI present | done (guided tours not built — see change report) |
| Legal pages + consent + business-identity register | web `/privacy,/terms,/cookies`, `modules/admin` compliance | pages render; placeholders flagged | partial |
| Security controls (sessions, CSRF, rate limit, RBAC, audit, uploads) | see `docs/security/security-audit-report.md` | verify (34 checks) + unit tests | done / open items listed |
| Accessibility (WCAG 2.2 AA target) | see `docs/security/accessibility-assessment.md` | manual checks; no axe run | partial |
| Deployment (Docker optional, env, migrations, backups) | `docs/deployment`, `docker-compose.yml` | documented | partial |

## Not built (explicit)

- Visual drag-and-drop form builder UI (the API supports reordering; the web
  screen lists/creates/publishes but does not provide the interactive canvas).
- Guided interactive tours (`user_help_progress` table and endpoint exist; the
  overlay UI is not built).
- In-app consent banner component (the API + storage exist; the banner UI is not
  rendered because no non-essential tracking is enabled by default).
- Compensation approval UI, appeal submission UI, improvement-plan editor UI.
