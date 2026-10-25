# Data inventory (derived from the actual implementation)

This inventory was built by inspecting the Prisma schema, the API routes, the
web forms and the network behavior — **not** inferred from package names.

| Data | Purpose | Required? | Stored where | Who can access | Third parties | Retention |
|---|---|---|---|---|---|---|
| Name, email, phone | Account & identification | name/email yes; phone optional | `users` | Self; admins in scope | none by default | org policy |
| Password hash (bcrypt) | Authentication | yes | `users.password_hash` | never returned | none | account lifetime |
| Sessions (id, ip, ua) | Keep users signed in | yes | `sessions` | self; admins (security view) | none | until logout/expiry |
| Employee record (no, unit, position, manager) | Org records & evaluation scope | yes | `employees`, `employee_manager_history` | scoped by relationship | none | org policy |
| Evaluation answers & scores | Performance evaluation | yes | `evaluation_responses`, `evaluation_scores`, `final_evaluation_results` | evaluator, subject (published), HR/admin by permission | none by default | org policy |
| Manager feedback & reviews | Review workflow | yes | `evaluation_reviews` | HR/admin in scope | none | org policy |
| AI chat input/output | Assistant (opt-in) | optional | `ai_conversations`, `ai_messages` | self | configured AI provider (only if enabled) | retention setting |
| AI usage events | Metering (no prompt content) | yes when AI on | `ai_usage_events` | admins | none | org policy |
| Audit logs | Security accountability | yes | `audit_logs` | `audit.view` holders | none | org policy |
| Consent preferences | Lawful basis tracking | yes when tracked | `consent_preferences` | self; admins | none | org policy |
| Settings / compliance identity | Configuration & disclosures | yes | `settings`, `compliance_profile` | admins | rendered on public policy pages | n/a |

## Sensitive fields deliberately NOT collected

Date of birth, national ID, home address, photographs, demographic, health and
family details are **not** collected. There is no field for them in the schema.

## Cookies / local storage (from the actual code)

| Name | Type | Purpose | Duration |
|---|---|---|---|
| `pe_session` | HttpOnly first-party | Session | 12h sliding |
| `pe_csrf` | first-party, readable | CSRF double-submit | session |

No analytics, pixels or third-party trackers are loaded by default.

## Unresolved (needs business input)

Retention periods, international transfers and the lawful basis for each
processing activity must be defined by the organization
(`[REQUIRES BUSINESS CONFIRMATION]`).
