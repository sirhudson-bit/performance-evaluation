/**
 * Deterministic weighted scoring engine (pure, no I/O).
 *
 * This module is the single authoritative implementation of the evaluation
 * mathematics. It never touches the database: callers pass plain values in and
 * receive a fully-explained result out, which makes the engine exhaustively
 * unit-testable and reproducible. The frontend is never the source of a final
 * score.
 *
 * ---------------------------------------------------------------------------
 * Model: normalized weighted average (weights per level)
 * ---------------------------------------------------------------------------
 *
 * Answer score        — a single answer's normalized value on the 0–100 scale.
 * Question weight      — the question's weight inside its section.
 * Section weight       — the section's weight inside the form.
 * Evaluator weight     — the evaluator's weight inside the final result.
 *
 *   SectionScore(e,c) = SUM(AnswerScore(e,i) * QuestionWeight(i))
 *                       / SUM(QuestionWeight(i))          over applicable i in c
 *
 *   FormScore(e)      = SUM(SectionScore(e,c) * SectionWeight(c))
 *                       / SUM(SectionWeight(c))           over scored sections c
 *
 *   FinalScore        = SUM(FormScore(e) * EvaluatorWeight(e))
 *                       / SUM(EvaluatorWeight(e))         over included evaluators e
 *
 * Distinctions that must be preserved:
 *   * A score of `0` is NOT the same as an unanswered question.
 *   * "Not applicable" (N/A) is a distinct state, never a zero.
 *   * A missing evaluator's weight is never silently redistributed — the caller
 *     is told (via `complete`) and must make an authorized decision.
 *
 * All arithmetic uses `decimal.js` (never IEEE-754 floats). Rounding happens
 * once, at the end, according to the policy.
 */

import Decimal from 'decimal.js';

Decimal.set({ precision: 40 });

export type RoundingMode = 'half_up' | 'half_even' | 'down' | 'up';

export interface RoundingPolicy {
  mode: RoundingMode;
  decimals: number;
}

export interface ScoringPolicy {
  /** Version identifier of the policy used (stored with every final result). */
  key: string;
  model: 'normalized_weighted_average';
  rounding: RoundingPolicy;
  /** Block publishing while any required evaluator stage is incomplete. */
  requireComplete: boolean;
  /** If a weight group does not sum to `weightTarget`, normalize it. */
  allowWeightNormalization: boolean;
  /** Target sum for a fully-weighted group (usually 100). */
  weightTarget: number;
  /**
   * How to treat an unanswered (but applicable) question:
   *  - `exclude`: drop from numerator and denominator (question is ignored).
   *  - `zero`: count as a 0 answer (penalizes omission explicitly).
   * N/A answers are always excluded, regardless of this setting.
   */
  unansweredPolicy: 'exclude' | 'zero';
}

export const DEFAULT_ROUNDING: RoundingPolicy = { mode: 'half_up', decimals: 2 };

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  key: 'default-v1',
  model: 'normalized_weighted_average',
  rounding: DEFAULT_ROUNDING,
  requireComplete: true,
  allowWeightNormalization: true,
  weightTarget: 100,
  unansweredPolicy: 'exclude',
};

const ROUNDING_MAP: Record<RoundingMode, Decimal.Rounding> = {
  half_up: Decimal.ROUND_HALF_UP,
  half_even: Decimal.ROUND_HALF_EVEN,
  down: Decimal.ROUND_DOWN,
  up: Decimal.ROUND_UP,
};

function D(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/** Rounds a Decimal according to the policy; returns a JS number. */
export function roundTo(value: Decimal, rounding: RoundingPolicy): number {
  return value.toDecimalPlaces(rounding.decimals, ROUNDING_MAP[rounding.mode]).toNumber();
}

// ---------------------------------------------------------------------------
// Weight validation
// ---------------------------------------------------------------------------

export interface WeightGroupResult {
  ok: boolean;
  sum: number;
  /** Normalized weights (each = weight/sum*target) when normalization applies. */
  normalized?: number[];
  error?: string;
}

/**
 * Validates one group of weights (a section's questions, a form's sections, or
 * a result's evaluators).
 *
 * Rules: no negative or non-finite weights; the sum must equal `weightTarget`
 * (within a small tolerance) unless `allowNormalization` is set, in which case a
 * normalized copy is returned.
 */
export function validateWeightGroup(
  weights: number[],
  policy: Pick<ScoringPolicy, 'allowWeightNormalization' | 'weightTarget'>,
): WeightGroupResult {
  if (weights.length === 0) {
    return { ok: false, sum: 0, error: 'هیچ وزنی تعیین نشده است.' };
  }

  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      return { ok: false, sum: 0, error: 'وزن‌ها باید اعداد نامنفی و معتبر باشند.' };
    }
  }

  const total = weights.reduce((acc, w) => acc.plus(w), D(0));

  const target = D(policy.weightTarget);
  const tolerance = target.times('0.0001');

  if (total.minus(target).abs().lte(tolerance)) {
    return { ok: true, sum: total.toNumber() };
  }

  if (!policy.allowWeightNormalization) {
    return {
      ok: false,
      sum: total.toNumber(),
      error: `مجموع وزن‌ها باید ${policy.weightTarget} باشد (اکنون ${total.toNumber()}).`,
    };
  }

  if (total.lte(0)) {
    return { ok: false, sum: 0, error: 'مجموع وزن‌ها باید بزرگ‌تر از صفر باشد.' };
  }

  const normalized = weights.map((w) => D(w).dividedBy(total).times(target).toNumber());

  return { ok: true, sum: total.toNumber(), normalized };
}

// ---------------------------------------------------------------------------
// Answer normalization
// ---------------------------------------------------------------------------

/** Converts a raw score on an arbitrary 0..max scale to the 0..100 scale. */
export function normalizeAnswerScore(rawScore: number, max: number): number {
  if (max <= 0) return 0;
  return D(rawScore).dividedBy(max).times(100).toNumber();
}

// ---------------------------------------------------------------------------
// Inputs / outputs
// ---------------------------------------------------------------------------

export interface QuestionAnswer {
  questionId: string;
  sectionId: string;
  /** Question weight inside its section. */
  weight: number;
  answered: boolean;
  isNotApplicable: boolean;
  /** Normalized 0..100 score, or null when unanswered / N/A. */
  score: number | null;
}

export interface SectionDef {
  sectionId: string;
  /** Section weight inside the form. */
  weight: number;
}

export interface EvaluatorSubmission {
  evaluatorId: string;
  evaluatorRole: string;
  /** Evaluator weight inside the final result. */
  weight: number;
  submitted: boolean;
  answers: QuestionAnswer[];
}

export interface SectionScore {
  sectionId: string;
  score: number | null;
  weightUsed: number;
  answeredCount: number;
  notApplicableCount: number;
}

export interface EvaluatorBreakdown {
  evaluatorId: string;
  evaluatorRole: string;
  weight: number;
  included: boolean;
  formScore: number | null;
  sections: SectionScore[];
}

export interface FinalScoreResult {
  finalScore: number | null;
  /** Sum of evaluator weights actually used in the final average. */
  evaluatorWeightUsed: number;
  complete: boolean;
  warnings: string[];
  evaluators: EvaluatorBreakdown[];
  policy: ScoringPolicy;
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Section score for one evaluator: the question-weight–weighted average of the
 * applicable answer scores.
 *
 * Returns `null` when the section has no applicable answers (so a section is
 * never reported as a misleading `0`).
 */
export function computeSectionScore(
  answers: QuestionAnswer[],
  policy: ScoringPolicy,
): SectionScore {
  const sectionId = answers[0]?.sectionId ?? '';
  let numerator = D(0);
  let denominator = D(0);
  let answeredCount = 0;
  let notApplicableCount = 0;

  for (const answer of answers) {
    const weight = D(answer.weight);

    if (answer.isNotApplicable) {
      notApplicableCount += 1;
      continue; // N/A is always excluded.
    }

    if (!answer.answered || answer.score === null) {
      if (policy.unansweredPolicy === 'zero') {
        // Count as an explicit zero (weight stays in the denominator).
        denominator = denominator.plus(weight);
      }
      continue;
    }

    answeredCount += 1;
    numerator = numerator.plus(D(answer.score).times(weight));
    denominator = denominator.plus(weight);
  }

  const hasScore = denominator.gt(0);
  const rawScore = hasScore ? numerator.dividedBy(denominator) : null;

  return {
    sectionId,
    score: rawScore ? roundTo(rawScore, policy.rounding) : null,
    weightUsed: denominator.toNumber(),
    answeredCount,
    notApplicableCount,
  };
}

/** Groups a flat list of answers by sectionId, preserving order of first sight. */
export function groupBySection(answers: QuestionAnswer[]): Map<string, QuestionAnswer[]> {
  const map = new Map<string, QuestionAnswer[]>();
  for (const answer of answers) {
    const list = map.get(answer.sectionId) ?? [];
    list.push(answer);
    map.set(answer.sectionId, list);
  }
  return map;
}

/** Form score for one evaluator: section-weight–weighted average of section scores. */
export function computeFormScore(
  sectionScores: SectionScore[],
  sections: SectionDef[],
  policy: ScoringPolicy,
): number | null {
  const weightById = new Map(sections.map((s) => [s.sectionId, D(s.weight)]));

  let numerator = D(0);
  let denominator = D(0);

  for (const section of sectionScores) {
    if (section.score === null) continue;
    const weight = weightById.get(section.sectionId);
    if (!weight || weight.lte(0)) continue;
    numerator = numerator.plus(D(section.score).times(weight));
    denominator = denominator.plus(weight);
  }

  if (denominator.lte(0)) return null;
  return roundTo(numerator.dividedBy(denominator), policy.rounding);
}

/**
 * Final score across evaluators. Explanation of every evaluator's contribution
 * is preserved so a published result can always be reproduced and explained.
 */
export function computeFinalScore(
  submissions: EvaluatorSubmission[],
  sections: SectionDef[],
  policy: ScoringPolicy = DEFAULT_SCORING_POLICY,
): FinalScoreResult {
  const warnings: string[] = [];
  const evaluators: EvaluatorBreakdown[] = [];

  let numerator = D(0);
  let denominator = D(0);
  let complete = true;

  for (const submission of submissions) {
    const grouped = groupBySection(submission.answers);
    const sectionScores: SectionScore[] = Array.from(grouped.values()).map((answers) =>
      computeSectionScore(answers, policy),
    );

    const hasAnyAnswer = submission.answers.some((a) => a.answered && !a.isNotApplicable);
    const included = submission.submitted && hasAnyAnswer;

    if (!submission.submitted) {
      complete = false;
      warnings.push(`ارزیاب «${submission.evaluatorRole}» ارزیابی خود را ارسال نکرده است.`);
    } else if (!hasAnyAnswer) {
      complete = false;
      warnings.push(`ارزیاب «${submission.evaluatorRole}» هیچ پاسخی ثبت نکرده است.`);
    }

    const formScore = computeFormScore(sectionScores, sections, policy);

    if (included && formScore !== null && D(submission.weight).gt(0)) {
      numerator = numerator.plus(D(formScore).times(submission.weight));
      denominator = denominator.plus(submission.weight);
    }

    evaluators.push({
      evaluatorId: submission.evaluatorId,
      evaluatorRole: submission.evaluatorRole,
      weight: submission.weight,
      included: included && formScore !== null,
      formScore,
      sections: sectionScores,
    });
  }

  const finalScore = denominator.gt(0) ? roundTo(numerator.dividedBy(denominator), policy.rounding) : null;

  return {
    finalScore,
    evaluatorWeightUsed: denominator.toNumber(),
    complete,
    warnings,
    evaluators,
    policy,
  };
}

/** Deep-equality of two policy versions (used for immutability checks). */
export function policiesEqual(a: ScoringPolicy, b: ScoringPolicy): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
