# Security audit report

Baseline: **OWASP ASVS 5.0.0** (verified as the current major version before
mapping). This report separates *what was implemented*, *what was automatically
tested*, *what was manually verified*, and *what remains open*. A clean scan is
not a security guarantee.

## Implemented controls (with location)

| Control | Where | Status |
|---|---|---|
| Password hashing (bcrypt, cost 12) | `apps/api/src/modules/auth`, seed | Implemented |
| DB-backed sessions; revocation is real | `apps/api/src/lib/sessions.ts`, `middleware/auth.ts` | Implemented |
| Session cookie HttpOnly + SameSite=Lax (+ Secure in prod) | `modules/auth/routes.ts` | Implemented |
| CSRF (double-submit) on all mutations | `apps/api/src/middleware/csrf.ts` | Implemented + tested |
| Login rate limiting; identical error for unknown email / wrong password | `middleware/rateLimit.ts`, `modules/auth` | Implemented + tested |
| Password reset: single-use, 1h, revokes sessions | `modules/auth/routes.ts` | Implemented |
| RBAC (DB-backed permission catalog) enforced server-side | `middleware/auth.ts`, `packages/shared/permissions.ts` | Implemented + tested |
| Data-scope authorization (manager ≠ all employees) | `middleware/scope.ts` | Implemented + tested |
| Cross-org single-record reads → 404 (never 403) | `middleware/scope.ts` | Implemented + tested |
| Workflow transition validation | `packages/shared/workflow.ts`, `modules/*` | Implemented |
| AI provider keys encrypted at rest (AES-256-GCM), never returned | `lib/crypto.ts`, `modules/ai` | Implemented |
| Audit log (append-only) with secret redaction | `lib/audit.ts` | Implemented |
| Helmet headers, restrictive CORS, JSON error envelope | `apps/api/src/app.ts`, `lib/http.ts` | Implemented |
| Excel formula-injection neutralisation | `lib/excel.ts` | Implemented |
| Export files outside `public/`, auth+expiry-checked download | `modules/reports` | Implemented + tested |
| Upload type/size limits + content parse guard | `modules/reports/routes.ts` | Implemented |

## Automated tests executed

`scripts/verify.cjs` (34 checks) — passing:

- CSRF: a mutation without the header is refused (403).
- RBAC: an employee cannot list users or the directory (403).
- Data scope: a manager's employee list is `seesAll=false`.
- Anonymous access to a protected page/endpoint → 401.
- Anonymous export download → 401.
- Unknown/foreign employee id → 404.
- AI is unavailable while unconfigured (503) and works once enabled.

`npm test` — scoring-engine unit tests (normal, boundary, missing-answer, N/A,
rounding, weight normalisation, no silent weight redistribution).

## Manually verified

- Session revocation on logout and on password change (DB row deleted).
- Cookies are `HttpOnly`/`SameSite=Lax` in development.
- Provider API key is never present in any `/ai/providers` response (masked only).

## Open / not performed (honest)

- **No penetration test, load test, or dynamic scanner run.** These require an
  authorized, isolated environment and were not performed.
- **CSP nonce** is not applied at the API tier (the API is JSON-only); a strict
  CSP belongs at the web/reverse-proxy tier and must be configured there.
- **`npm audit` findings** exist (dev toolchain and some transitive packages).
  No blind `--force` fixes were applied; see `CHANGE-REPORT.md` for the
  decision to leave them as reviewed, not silently "fixed".
- **Upload AV scanning** is not implemented; uploads are type/size/parse-limited
  only.
- **Dependency scanning / secret scanning** were not run as separate tools.

## Remediation status

No known critical or high finding was silently ignored; each item above is
either implemented-and-tested or explicitly listed as open with the reason.
