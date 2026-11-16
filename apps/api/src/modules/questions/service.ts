import { db } from '../../db.js';

export interface QuestionOptionDraft {
  label: string;
  value: string;
  score?: number | null;
  isNotApplicable: boolean;
  sortOrder: number;
}

export interface QuestionDraft {
  stableKey: string;
  categoryId?: number | null;
  title: string;
  text: string;
  guidance?: string | null;
  subjectType: string;
  respondentRoles: string[];
  answerType: string;
  required: boolean;
  weight: number;
  scoring: Record<string, unknown>;
  condition?: Record<string, unknown> | null;
  status: string;
  sortOrder: number;
  options: QuestionOptionDraft[];
}

/**
 * Creates a question, its options and its first immutable version.
 *
 * Shared by the single-question endpoint and the bulk Excel import so both paths
 * can never drift apart (the import would otherwise be a second, quietly
 * different implementation of the same rules).
 */
export async function createQuestionWithOptions(
  organizationId: number,
  input: QuestionDraft,
  createdBy?: number | null,
) {
  const question = await db.question.create({
    data: {
      organizationId,
      stableKey: input.stableKey,
      categoryId: input.categoryId ?? null,
      title: input.title,
      text: input.text,
      guidance: input.guidance ?? null,
      subjectType: input.subjectType,
      respondentRoles: input.respondentRoles,
      answerType: input.answerType,
      required: input.required,
      weight: input.weight,
      scoring: input.scoring as object,
      ...(input.condition ? { condition: input.condition as object } : {}),
      status: input.status,
      sortOrder: input.sortOrder,
      currentVersion: 1,
    },
  });

  if (input.options.length > 0) {
    await db.questionOption.createMany({
      data: input.options.map((o) => ({
        questionId: question.id,
        label: o.label,
        value: o.value,
        score: o.score ?? null,
        isNotApplicable: o.isNotApplicable,
        sortOrder: o.sortOrder,
      })),
    });
  }

  await createQuestionVersion(question.id, 1, createdBy ?? null);
  return question;
}

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
