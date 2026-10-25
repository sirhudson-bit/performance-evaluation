import {
  computeSectionScore,
  computeFormScore,
  computeFinalScore,
  groupBySection,
  type EvaluatorSubmission,
  type QuestionAnswer,
  type SectionDef,
  type ScoringPolicy,
} from '@pe/shared';
import { Prisma } from '@prisma/client';
import { db } from '../../db.js';
import { toScoringPolicy, deriveAnswerScore, resolveComputedScores, type QuestionSnapshot } from '../forms/service.js';

/**
 * Persists an answer row, storing both the raw answer and its normalized score
 * (0–100). Text answers keep a null score and are never auto-scored.
 */
export async function saveResponse(params: {
  organizationId: number;
  assignmentId: number;
  formQuestionId: number;
  questionVersionId: number;
  answerType: string;
  snapshot: QuestionSnapshot;
  value: unknown;
  isNotApplicable: boolean;
}): Promise<void> {
  const derived = deriveAnswerScore(params.snapshot, params.value, params.isNotApplicable);

  await db.evaluationResponse.upsert({
    where: { assignmentId_formQuestionId: { assignmentId: params.assignmentId, formQuestionId: params.formQuestionId } },
    update: {
      value: params.value as Prisma.InputJsonValue,
      score: derived.score !== null ? new Prisma.Decimal(derived.score) : null,
      isNotApplicable: derived.isNotApplicable,
      answeredAt: new Date(),
    },
    create: {
      organizationId: params.organizationId,
      assignmentId: params.assignmentId,
      formQuestionId: params.formQuestionId,
      questionVersionId: params.questionVersionId,
      answerType: params.answerType,
      value: params.value as Prisma.InputJsonValue,
      score: derived.score !== null ? new Prisma.Decimal(derived.score) : null,
      isNotApplicable: derived.isNotApplicable,
    },
  });
}

/** Recomputes and stores section/form scores for one assignment. */
export async function computeAssignmentScores(assignmentId: number): Promise<{ formScore: number | null; sections: { sectionId: number; score: number | null }[] }> {
  const assignment = await db.evaluationAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      responses: true,
      formVersion: { include: { sections: { orderBy: { sortOrder: 'asc' } }, questions: { include: { questionVersion: true } }, scoringPolicy: true } },
      cycle: { include: { scoringPolicy: true } },
    },
  });

  const policy = toScoringPolicy(assignment.cycle.scoringPolicy?.config ?? assignment.formVersion.scoringPolicy?.config);
  const responseByFq = new Map(assignment.responses.map((r) => [r.formQuestionId, r]));

  const answers: QuestionAnswer[] = [];
  const computed: { formQuestionId: number; expression: string | null }[] = [];
  const scoreByStableKey: Record<string, number> = {};

  assignment.formVersion.questions.forEach((fq, index) => {
    const snapshot = (fq.questionVersion.snapshot ?? {}) as unknown as QuestionSnapshot;
    const response = responseByFq.get(fq.id);

    if (fq.computed) {
      // Calculated indicator: no stored response, resolved from other answers below.
      computed.push({ formQuestionId: index, expression: (fq.formula as { expression?: string } | null)?.expression ?? null });
      answers.push({ questionId: String(fq.id), sectionId: String(fq.sectionId), weight: Number(fq.weight), answered: false, isNotApplicable: false, score: null });
      return;
    }
    if (!response) return;

    const score = response.score !== null ? Number(response.score) : null;
    const answered = response.value !== null && response.value !== undefined;
    if (answered && !response.isNotApplicable && score !== null && snapshot.stableKey) {
      scoreByStableKey[snapshot.stableKey] = score;
    }
    answers.push({
      questionId: String(fq.id),
      sectionId: String(fq.sectionId),
      weight: Number(fq.weight),
      answered,
      isNotApplicable: response.isNotApplicable,
      score,
    });
  });

  for (const [index, score] of resolveComputedScores(computed, scoreByStableKey)) {
    const target = answers[index];
    if (target) {
      target.answered = true;
      target.score = score;
    }
  }

  const grouped = groupBySection(answers);
  const sectionScores = [...grouped.entries()].map(([sectionId, list]) => {
    const sc = computeSectionScore(list, policy);
    return { sectionId: Number(sectionId), raw: sc };
  });
  const sections: SectionDef[] = assignment.formVersion.sections.map((s) => ({ sectionId: String(s.id), weight: Number(s.weight) }));
  const formScore = computeFormScore(sectionScores.map((s) => s.raw), sections, policy);

  await db.evaluationScore.deleteMany({ where: { assignmentId } });
  await db.evaluationScore.createMany({
    data: sectionScores.map((s) => ({
      organizationId: assignment.organizationId,
      assignmentId,
      sectionId: s.sectionId,
      sectionScore: s.raw.score !== null ? new Prisma.Decimal(s.raw.score) : null,
      formScore: formScore !== null ? new Prisma.Decimal(formScore) : null,
      detail: s.raw as unknown as Prisma.InputJsonValue,
    })),
  });

  return {
    formScore,
    sections: sectionScores.map((s) => ({ sectionId: s.sectionId, score: s.raw.score })),
  };
}

/**
 * Computes and stores the final evaluation result for an employee in a cycle,
 * preserving the full per-evaluator / per-section breakdown and the scoring
 * policy version used (so a result is always reproducible and explainable).
 */
export async function computeFinalResult(cycleId: number, employeeId: number): Promise<{ finalScore: number | null; complete: boolean; warnings: string[]; breakdown: unknown }> {
  const cycle = await db.evaluationCycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: {
      scoringPolicy: true,
      formVersion: { include: { sections: { orderBy: { sortOrder: 'asc' } }, questions: { include: { questionVersion: true } }, scoringPolicy: true } },
    },
  });

  const policy: ScoringPolicy = toScoringPolicy(cycle.scoringPolicy?.config ?? cycle.formVersion.scoringPolicy?.config);
  const sections: SectionDef[] = cycle.formVersion.sections.map((s) => ({ sectionId: String(s.id), weight: Number(s.weight) }));

  const assignments = await db.evaluationAssignment.findMany({
    where: { cycleId, employeeId },
    include: { responses: true },
  });

  const fqById = new Map(cycle.formVersion.questions.map((q) => [q.id, q]));

  const submissions: EvaluatorSubmission[] = assignments.map((assignment) => {
    const answers: QuestionAnswer[] = assignment.responses.map((r) => {
      const fq = fqById.get(r.formQuestionId);
      return {
        questionId: String(r.formQuestionId),
        sectionId: String(fq?.sectionId ?? 0),
        weight: Number(fq?.weight ?? 0),
        answered: r.value !== null && r.value !== undefined,
        isNotApplicable: r.isNotApplicable,
        score: r.score !== null ? Number(r.score) : null,
      };
    });
    return {
      evaluatorId: String(assignment.id),
      evaluatorRole: assignment.evaluatorRole,
      weight: Number(assignment.weight),
      submitted: ['submitted', 'under_review', 'approved', 'published'].includes(assignment.status),
      answers,
    };
  });

  const result = computeFinalScore(submissions, sections, policy);

  const breakdown = {
    evaluators: result.evaluators,
    evaluatorWeightUsed: result.evaluatorWeightUsed,
    policy: { key: policy.key, model: policy.model, rounding: policy.rounding, weightTarget: policy.weightTarget },
    computedAt: new Date().toISOString(),
  };

  await db.finalEvaluationResult.upsert({
    where: { cycleId_employeeId: { cycleId, employeeId } },
    update: {
      finalScore: result.finalScore !== null ? new Prisma.Decimal(result.finalScore) : null,
      breakdown: breakdown as unknown as Prisma.InputJsonValue,
      scoringPolicyVersionId: cycle.scoringPolicyId ?? cycle.formVersion.scoringPolicyId,
    },
    create: {
      organizationId: cycle.organizationId,
      cycleId,
      employeeId,
      finalScore: result.finalScore !== null ? new Prisma.Decimal(result.finalScore) : null,
      breakdown: breakdown as unknown as Prisma.InputJsonValue,
      scoringPolicyVersionId: cycle.scoringPolicyId ?? cycle.formVersion.scoringPolicyId,
      status: 'draft',
    },
  });

  return { finalScore: result.finalScore, complete: result.complete, warnings: result.warnings, breakdown };
}
