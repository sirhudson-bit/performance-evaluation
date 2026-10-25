# Accessibility assessment (WCAG 2.2 AA — target)

This is an implementation effort, not a final polish pass. Automated checks do
not prove conformance; manual keyboard and contrast testing is also required.

## Implemented

- Semantic HTML, `lang="fa"` and `dir="rtl"` on `<html>`.
- One visible, consistent focus ring (`:focus-visible`) across the app.
- A "skip to main content" link on every page.
- Form controls are `font: inherit` and sit in `<label>`s via the `Field`
  component; validation errors use `role="alert"`.
- Page structure uses real headings (`h1`/`h2`/`h3`).
- Status is never conveyed by colour alone — `StatusBadge` always shows text.
- `prefers-reduced-motion` disables transitions/animations globally.
- The mobile navigation button has `aria-label` and `aria-expanded`; the sidebar
  is reachable and closable.
- Discrete choice questions use radio/checkbox semantics (keyboard operable),
  not drag-only widgets.
- The AI chat exposes a `role="status"` loading message.

## Manual checks performed

- Keyboard: tab order through the login form, sidebar, tables and the evaluation
  form; discrete answers are selectable by keyboard.
- Focus visibility on the primary interactive elements.

## Not yet verified / open

- No axe-core automated scan was run (the dependency was not added); a run is
  planned. Without it, coverage claims are limited to the manual checks above.
- Dialog focus trapping (Radix primitives are installed and RTL-configured via
  `DirectionProvider`, but no modal is exercised in the built screens yet).
- No screen-reader walkthrough was performed.
- Contrast ratios were chosen to meet 4.5:1 for body text / 3:1 for large text
  but were **not** machine-verified across every state.

**No claim of full WCAG conformance is made.** The above lists exactly what was
checked and what remains.
