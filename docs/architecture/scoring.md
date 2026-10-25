# Scoring engine

`packages/shared/src/scoring.ts` is the single authoritative implementation of
the evaluation mathematics. It is **pure** (no database, no I/O) and is used by
the server. The frontend only ever displays a preview computed by the server.

## Model — normalized weighted average

Four concepts are kept separate:

| Concept | Meaning |
|---|---|
| Answer score | One answer's value normalized to 0–100 |
| Question weight | The question's weight inside its section |
| Section weight | The section's weight inside the form |
| Evaluator weight | The evaluator's weight inside the final result |

```
SectionScore(e,c) = Σ(AnswerScore(e,i)·QuestionWeight(i)) / Σ(QuestionWeight(i))
FormScore(e)      = Σ(SectionScore(e,c)·SectionWeight(c)) / Σ(SectionWeight(c))
FinalScore        = Σ(FormScore(e)·EvaluatorWeight(e))     / Σ(EvaluatorWeight(e))
```

The original answer is always stored alongside its normalized score and its
scoring definition, so a result can be explained and reproduced.

## Precision and rounding

- All arithmetic uses `decimal.js` (never IEEE-754 floats).
- Scores are stored as `Decimal(7,4)`; the policy defines the presentation
  rounding (default: half-up, 2 decimals).
- Rounding happens once, at the end of each level.

## Validation rules

- Weights must be finite and non-negative. A group whose sum differs from the
  target is an error unless `allowWeightNormalization` is set (the default), in
  which case a normalized copy is produced and a warning is surfaced at publish.
- A score of `0` is treated as a real score and is **different** from an
  unanswered question.
- "Not applicable" (N/A) is a distinct state, always excluded.
- A missing evaluator's weight is **never silently redistributed**: only
  included evaluators contribute, and `complete` is `false` with a warning.
- Publishing is blocked while required stages are incomplete (unless an
  authorized, documented exception applies).

## Configuration

`ScoringPolicy` (stored per version) controls: `rounding`, `requireComplete`,
`allowWeightNormalization`, `weightTarget`, and `unansweredPolicy`
(`exclude` | `zero`). Every final result stores the policy version it used.

## Tests

`tests/unit/scoring.test.ts` covers normal, boundary, missing-answer,
not-applicable, zero-vs-unanswered, rounding, weight-normalization and
non-redistribution scenarios.
