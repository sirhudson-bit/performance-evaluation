# Legal & privacy readiness report

> This is a **fact-based draft**, not legal advice. It is written against the
> behavior verified in this repository. The organization, its jurisdiction and
> the applicable regimes must be confirmed by the business owner and, where
> needed, by qualified counsel.

## Factual baseline (from the code)

- A single organization; users, employees, evaluators, HR and admins.
- Personal data categories: see `docs/privacy/data-inventory.md`.
- Cookies: only `pe_session` and `pe_csrf` (both strictly necessary).
- No analytics/tracking by default; no payment integration exists in code.
- AI is opt-in and provider-based; provider keys are encrypted; no personal
  evaluation data is sent by default.

## Applicable / potentially applicable regimes

Cannot be determined without the confirmed jurisdictions. Candidates to assess
once known: the operating organization's jurisdiction, the employees' locations,
and (if the AI/email providers are abroad) cross-border transfer rules.

**Needs input:** jurisdictions, employee locations, whether the platform is
internal or commercial.

## Documents produced (Persian, in-app)

- `/privacy` — privacy policy reflecting the verified data inventory.
- `/terms` — terms of use, scoped to verified facts.
- `/cookies` — cookie policy listing the two real cookies.
- Refund policy: **not created**, because no paid offering exists in the code.
  It must be added only if a paid offering is introduced and confirmed.

## Consent

- Consent categories exist; optional categories default to off; consent is
  recorded with policy version and is withdrawable.
- Strictly-necessary cookies are exempt.
- Whether a banner is legally required depends on the confirmed jurisdictions —
  the analysis is left explicit rather than assumed.

## Third-party & tracking inventory

Managed in-product at **پنل مدیریت → انطباق و حریم خصوصی → سرویس‌های ثالث**,
reflecting only services actually in use (email/AI when configured). Nothing is
listed that the code does not use.

## Changes implemented for compliance

- Data minimization: no sensitive identity fields exist in the schema.
- `[REQUIRES BUSINESS CONFIRMATION]` placeholders on every unverified identity
  fact; they are a production-readiness blocker, not silently filled.
- Admin compliance register for business identity, surfaced on policy pages.
- Optional form fields are never made mandatory.

## Unresolved items (blockers / decisions needed)

1. Legal entity name, registration, address, contact — **[REQUIRES BUSINESS CONFIRMATION]**
   (enter via admin compliance panel).
2. Applicable jurisdictions and lawful basis per processing activity.
3. Retention periods per data category.
4. Whether the AI/email providers entail an international transfer, and the
   safeguards for it.
5. Whether a consent banner is legally required for the confirmed audience.

## Matters requiring qualified legal counsel

- Governing law / jurisdiction clauses for the terms.
- Employee-monitoring and workplace-evaluation obligations in the relevant
  labour law.
- Cross-border transfer mechanism, if any.
