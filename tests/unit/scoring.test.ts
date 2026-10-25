import { describe, it, expect } from 'vitest';
import {
  computeSectionScore,
  computeFormScore,
  computeFinalScore,
  validateWeightGroup,
  normalizeAnswerScore,
  DEFAULT_SCORING_POLICY,
  type ScoringPolicy,
  type QuestionAnswer,
  type SectionDef,
  type EvaluatorSubmission,
} from '../../packages/shared/src/scoring';

const policy: ScoringPolicy = DEFAULT_SCORING_POLICY;

function answer(partial: Partial<QuestionAnswer>): QuestionAnswer {
  return {
    questionId: 'q1',
    sectionId: 's1',
    weight: 1,
    answered: true,
    isNotApplicable: false,
    score: 0,
    ...partial,
  };
}

describe('weights', () => {
  it('accepts a group that sums to the target', () => {
    const r = validateWeightGroup([60, 40], { allowWeightNormalization: false, weightTarget: 100 });
    expect(r.ok).toBe(true);
    expect(r.normalized).toBeUndefined();
  });

  it('normalizes when allowed and the sum differs', () => {
    const r = validateWeightGroup([3, 1], { allowWeightNormalization: true, weightTarget: 100 });
    expect(r.ok).toBe(true);
    expect(r.normalized).toEqual([75, 25]);
  });

  it('rejects a mis-summed group when normalization is off', () => {
    const r = validateWeightGroup([50, 30], { allowWeightNormalization: false, weightTarget: 100 });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('rejects negative weights', () => {
    const r = validateWeightGroup([120, -20], { allowWeightNormalization: true, weightTarget: 100 });
    expect(r.ok).toBe(false);
  });
});

describe('section score', () => {
  it('computes a question-weight weighted average', () => {
    const s = computeSectionScore(
      [answer({ questionId: 'a', weight: 2, score: 80 }), answer({ questionId: 'b', weight: 1, score: 50 })],
      policy,
    );
    // (80*2 + 50*1) / 3 = 70
    expect(s.score).toBe(70);
  });

  it('treats zero as a real score, different from unanswered', () => {
    const zero = computeSectionScore([answer({ score: 0, weight: 1 })], policy);
    expect(zero.score).toBe(0);

    const unanswered = computeSectionScore([answer({ answered: false, score: null, weight: 1 })], policy);
    expect(unanswered.score).toBeNull(); // excluded → no score, not zero
  });

  it('excludes N/A from the denominator', () => {
    const s = computeSectionScore(
      [answer({ questionId: 'a', weight: 1, score: 60 }), answer({ questionId: 'b', weight: 1, isNotApplicable: true, score: null })],
      policy,
    );
    expect(s.score).toBe(60);
    expect(s.notApplicableCount).toBe(1);
  });

  it('counts unanswered as zero when the policy says so', () => {
    const zeroPolicy: ScoringPolicy = { ...policy, unansweredPolicy: 'zero' };
    const s = computeSectionScore([answer({ questionId: 'a', weight: 1, score: 100 }), answer({ questionId: 'b', weight: 1, answered: false, score: null })], zeroPolicy);
    expect(s.score).toBe(50);
  });

  it('returns null when nothing is applicable', () => {
    const s = computeSectionScore([answer({ isNotApplicable: true, score: null })], policy);
    expect(s.score).toBeNull();
  });
});

describe('form and final score', () => {
  const sections: SectionDef[] = [
    { sectionId: 's1', weight: 60 },
    { sectionId: 's2', weight: 40 },
  ];

  it('applies section weights then evaluator weights', () => {
    const submissions: EvaluatorSubmission[] = [
      {
        evaluatorId: 'e1',
        evaluatorRole: 'manager',
        weight: 70,
        submitted: true,
        answers: [
          answer({ questionId: 's1q', sectionId: 's1', weight: 1, score: 90 }),
          answer({ questionId: 's2q', sectionId: 's2', weight: 1, score: 80 }),
        ],
      },
      {
        evaluatorId: 'e2',
        evaluatorRole: 'self',
        weight: 30,
        submitted: true,
        answers: [
          answer({ questionId: 's1q', sectionId: 's1', weight: 1, score: 70 }),
          answer({ questionId: 's2q', sectionId: 's2', weight: 1, score: 60 }),
        ],
      },
    ];

    const result = computeFinalScore(submissions, sections, policy);
    // e1 form = 90*0.6 + 80*0.4 = 86; e2 form = 70*0.6 + 60*0.4 = 66
    // final = (86*70 + 66*30) / 100 = 80
    expect(result.evaluators[0]?.formScore).toBe(86);
    expect(result.evaluators[1]?.formScore).toBe(66);
    expect(result.finalScore).toBe(80);
    expect(result.complete).toBe(true);
  });

  it('flags an incomplete result when an evaluator has not submitted', () => {
    const submissions: EvaluatorSubmission[] = [
      { evaluatorId: 'e1', evaluatorRole: 'manager', weight: 100, submitted: false, answers: [] },
    ];
    const result = computeFinalScore(submissions, sections, policy);
    expect(result.complete).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.finalScore).toBeNull();
  });

  it('never redistributes a missing evaluator weight silently (only included weights count)', () => {
    const submissions: EvaluatorSubmission[] = [
      { evaluatorId: 'e1', evaluatorRole: 'manager', weight: 60, submitted: true, answers: [answer({ sectionId: 's1', weight: 1, score: 100 }), answer({ sectionId: 's2', weight: 1, score: 100 })] },
      { evaluatorId: 'e2', evaluatorRole: 'self', weight: 40, submitted: false, answers: [] },
    ];
    const result = computeFinalScore(submissions, sections, policy);
    expect(result.finalScore).toBe(100); // only e1 contributes
    expect(result.evaluatorWeightUsed).toBe(60); // 40 not silently moved
    expect(result.complete).toBe(false);
  });
});

describe('rounding & normalization', () => {
  it('rounds half-up to the configured decimals', () => {
    const s = computeSectionScore([answer({ score: 33.333, weight: 1 })], { ...policy, rounding: { mode: 'half_up', decimals: 2 } });
    expect(s.score).toBe(33.33);
  });

  it('normalizes an arbitrary scale to 0–100', () => {
    expect(normalizeAnswerScore(7, 10)).toBe(70);
    expect(normalizeAnswerScore(1, 1)).toBe(100);
  });
});

describe('form score with weighted sections', () => {
  it('ignores a section that has no score', () => {
    const sectionScores = [
      { sectionId: 's1', score: 80, weightUsed: 1, answeredCount: 1, notApplicableCount: 0 },
      { sectionId: 's2', score: null, weightUsed: 0, answeredCount: 0, notApplicableCount: 0 },
    ];
    expect(computeFormScore(sectionScores, [{ sectionId: 's1', weight: 100 }, { sectionId: 's2', weight: 0 }], policy)).toBe(80);
  });
});
