import { computeSectionScore, computeFormScore, groupBySection, evaluateFormula, type QuestionAnswer, type SectionDef, type ScoringPolicy, DEFAULT_SCORING_POLICY } from '@pe/shared';
import { db } from '../../db.js';

export interface SnapshotOption {
  label: string;
  value: string;
  score: number | null;
  isNotApplicable: boolean;
}

export interface QuestionSnapshot {
  id?: number;
  stableKey?: string;
  title?: string;
  text?: string;
  guidance?: string | null;
  answerType: string;
  scoring?: Record<string, unknown>;
  options?: SnapshotOption[];
}

/** A calculated (quantitative) indicator: its score is derived from others. */
export interface ComputedQuestion {
  formQuestionId: number;
  expression: string | null;
}

/**
 * Resolves calculated indicators: each expression is evaluated over the other
 * questions' normalized scores, keyed by the question's stable identifier, and
 * clamped to 0–100. A formula that fails to evaluate is skipped (the question
 * stays unanswered) rather than breaking the whole scoring run.
 */
export function resolveComputedScores(
  questions: ComputedQuestion[],
  scoreByStableKey: Record<string, number>,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const q of questions) {
    if (!q.expression) continue;
    try {
      const value = evaluateFormula(q.expression, scoreByStableKey);
      out.set(q.formQuestionId, Math.max(0, Math.min(100, Math.round(value * 100) / 100)));
    } catch {
      /* skip an invalid formula */
    }
  }
  return out;
}

export interface DerivedAnswer {
  answered: boolean;
  isNotApplicable: boolean;
  score: number | null;
}

/**
 * Turns a raw answer into a normalized 0–100 score using the question's frozen
 * scoring definition. Text answers never receive an automatic score.
 */
export function deriveAnswerScore(question: QuestionSnapshot, value: unknown, isNotApplicable: boolean): DerivedAnswer {
  if (isNotApplicable) return { answered: true, isNotApplicable: true, score: null };

  const options = question.options ?? [];
  const type = question.answerType;

  const optionScore = (v: unknown): number | null => {
    const match = options.find((o) => o.value === String(v));
    return match && match.score !== null ? match.score : null;
  };

  if (type === 'rating_5' || type === 'single_choice') {
    if (value === null || value === undefined || value === '') return { answered: false, isNotApplicable: false, score: null };
    return { answered: true, isNotApplicable: false, score: optionScore(value) };
  }

  if (type === 'multi_choice') {
    const values = Array.isArray(value) ? value : [];
    const scores = values.map(optionScore).filter((s): s is number => s !== null);
    if (scores.length === 0) return { answered: values.length > 0, isNotApplicable: false, score: null };
    // Partial credit: the average of the selected options' scores.
    return { answered: true, isNotApplicable: false, score: scores.reduce((a, b) => a + b, 0) / scores.length };
  }

  if (type === 'yes_no') {
    if (value === null || value === undefined || value === '') return { answered: false, isNotApplicable: false, score: null };
    const fromOptions = optionScore(value);
    if (fromOptions !== null) return { answered: true, isNotApplicable: false, score: fromOptions };
    return { answered: true, isNotApplicable: false, score: String(value) === 'yes' ? 100 : 0 };
  }

  if (type === 'percentage') {
    const n = Number(value);
    if (!Number.isFinite(n)) return { answered: false, isNotApplicable: false, score: null };
    return { answered: true, isNotApplicable: false, score: Math.max(0, Math.min(100, n)) };
  }

  if (type === 'numeric_scale' || type === 'numeric') {
    const n = Number(value);
    if (!Number.isFinite(n)) return { answered: false, isNotApplicable: false, score: null };
    const scoring = (question.scoring ?? {}) as { min?: number; max?: number };
    const min = typeof scoring.min === 'number' ? scoring.min : 0;
    const max = typeof scoring.max === 'number' ? scoring.max : 100;
    if (max <= min) return { answered: true, isNotApplicable: false, score: Math.max(0, Math.min(100, n)) };
    const pct = ((n - min) / (max - min)) * 100;
    return { answered: true, isNotApplicable: false, score: Math.max(0, Math.min(100, pct)) };
  }

  // Text and anything else: recorded, not scored.
  const answered = value !== null && value !== undefined && String(value).trim() !== '';
  return { answered, isNotApplicable: false, score: null };
}

/**
 * Computes a preview score for a set of answers against a form version, using
 * the same engine the server uses for real results. Used by the builder.
 */
export async function previewVersionScoring(
  versionId: number,
  answers: { questionId: number; value: unknown; isNotApplicable: boolean }[],
): Promise<{
  formScore: number | null;
  sections: { sectionId: number; title: string; score: number | null; answeredCount: number }[];
  warnings: string[];
}> {
  const version = await db.formVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: {
      sections: { orderBy: { sortOrder: 'asc' } },
      questions: { include: { questionVersion: true }, orderBy: { sortOrder: 'asc' } },
      scoringPolicy: true,
    },
  });

  const policy = toScoringPolicy(version.scoringPolicy?.config);
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  const questionAnswers: QuestionAnswer[] = [];
  const warnings: string[] = [];
  const computedQuestions: ComputedQuestion[] = [];
  const scoreByStableKey: Record<string, number> = {};

  for (const [index, fq] of version.questions.entries()) {
    const snapshot = (fq.questionVersion.snapshot ?? {}) as unknown as QuestionSnapshot;
    const isComputed = Boolean(fq.computed);
    const provided = answerByQuestion.get(snapshot.id ?? -1);
    const derived = isComputed
      ? { answered: false, isNotApplicable: false, score: null }
      : deriveAnswerScore(snapshot, provided?.value, provided?.isNotApplicable ?? false);

    if (isComputed) {
      computedQuestions.push({ formQuestionId: index, expression: (fq.formula as { expression?: string } | null)?.expression ?? null });
    } else if (derived.answered && !derived.isNotApplicable && derived.score !== null && snapshot.stableKey) {
      scoreByStableKey[snapshot.stableKey] = derived.score;
    }

    questionAnswers.push({
      questionId: String(snapshot.id ?? fq.id),
      sectionId: String(fq.sectionId),
      weight: Number(fq.weight),
      answered: derived.answered,
      isNotApplicable: derived.isNotApplicable,
      score: derived.score,
    });
    if (fq.required && !isComputed && !derived.answered && !derived.isNotApplicable) {
      warnings.push(`پرسش «${String(snapshot.title ?? '')}» پاسخ داده نشده است.`);
    }
  }

  // Apply calculated indicators over the other answers' normalized scores.
  for (const [index, score] of resolveComputedScores(computedQuestions, scoreByStableKey)) {
    const target = questionAnswers[index];
    if (target) {
      target.answered = true;
      target.score = score;
    }
  }

  const grouped = groupBySection(questionAnswers);
  const sectionScores = [...grouped.values()].map((list) => computeSectionScore(list, policy));
  const sections: SectionDef[] = version.sections.map((s) => ({ sectionId: String(s.id), weight: Number(s.weight) }));
  const formScore = computeFormScore(sectionScores, sections, policy);

  const titleById = new Map(version.sections.map((s) => [String(s.id), s.title]));
  const scoreById = new Map(sectionScores.map((s) => [s.sectionId, s]));

  return {
    formScore,
    sections: version.sections.map((s) => {
      const sc = scoreById.get(String(s.id));
      return { sectionId: s.id, title: titleById.get(String(s.id)) ?? '', score: sc?.score ?? null, answeredCount: sc?.answeredCount ?? 0 };
    }),
    warnings,
  };
}

/** Reconstructs a ScoringPolicy from a stored config object. */
export function toScoringPolicy(config: unknown): ScoringPolicy {
  const c = (config ?? {}) as Partial<ScoringPolicy> & { rounding?: Partial<ScoringPolicy['rounding']> };
  return {
    key: c.key ?? 'stored',
    model: 'normalized_weighted_average',
    rounding: { mode: c.rounding?.mode ?? DEFAULT_SCORING_POLICY.rounding.mode, decimals: c.rounding?.decimals ?? 2 },
    requireComplete: c.requireComplete ?? true,
    allowWeightNormalization: c.allowWeightNormalization ?? true,
    weightTarget: c.weightTarget ?? 100,
    unansweredPolicy: c.unansweredPolicy ?? 'exclude',
  };
}
