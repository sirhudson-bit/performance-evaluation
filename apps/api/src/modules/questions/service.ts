import { db } from '../../db.js';

/**
 * Builds and stores a frozen snapshot of a question (with its options and
 * scoring) as a `QuestionVersion`. Published forms reference a QuestionVersion,
 * never the mutable Question — so a later edit to a question can never alter a
 * historical form or result.
 */
export async function createQuestionVersion(
  questionId: number,
  version: number,
  createdBy?: number | null,
): Promise<number> {
  const question = await db.question.findUniqueOrThrow({
    where: { id: questionId },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });

  const snapshot = {
    id: question.id,
    stableKey: question.stableKey,
    title: question.title,
    text: question.text,
    guidance: question.guidance,
    answerType: question.answerType,
    weight: Number(question.weight),
    subjectType: question.subjectType,
    respondentRoles: question.respondentRoles,
    scoring: question.scoring,
    condition: question.condition,
    options: question.options.map((o) => ({
      label: o.label,
      value: o.value,
      score: o.score ? Number(o.score) : null,
      isNotApplicable: o.isNotApplicable,
    })),
  };

  const row = await db.questionVersion.upsert({
    where: { questionId_version: { questionId, version } },
    update: { snapshot },
    create: { questionId, version, snapshot, createdBy: createdBy ?? null },
  });

  return row.id;
}
