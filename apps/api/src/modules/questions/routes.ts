import { Router } from 'express';
import { questionSchema, questionUpdateSchema, questionCategorySchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, conflict, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';
import { createQuestionVersion } from './service.js';

export const questionsRouter = Router();

// --- Categories ------------------------------------------------------------
questionsRouter.get(
  '/categories',
  requirePermission('questions.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.questionCategory.findMany({ where: { organizationId: orgId }, orderBy: { sortOrder: 'asc' }, include: { _count: { select: { questions: true } } } });
    sendData(res, { items });
  }),
);

questionsRouter.post(
  '/categories',
  requirePermission('questions.create'),
  validateBody(questionCategorySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { name: string; sortOrder: number; status: string };
    const row = await db.questionCategory.create({ data: { organizationId: orgId, name: body.name, sortOrder: body.sortOrder, status: body.status } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'question_category.created', entityType: 'question_category', entityId: row.id, after: body }, req);
    sendData(res, { id: row.id }, 201);
  }),
);

questionsRouter.patch(
  '/categories/:id',
  requirePermission('questions.edit'),
  validateBody(questionCategorySchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const row = await db.questionCategory.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.questionCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder as number } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'question_category.updated', entityType: 'question_category', entityId: id, after: body }, req);
    sendData(res, { ok: true });
  }),
);

// --- Questions -------------------------------------------------------------
questionsRouter.get(
  '/',
  requirePermission('questions.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;

    const items = await db.question.findMany({
      where: { organizationId: orgId, ...(status ? { status } : {}), ...(categoryId ? { categoryId } : {}) },
      include: { options: { orderBy: { sortOrder: 'asc' } }, category: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    sendData(res, { items });
  }),
);

questionsRouter.post(
  '/',
  requirePermission('questions.create'),
  validateBody(questionSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body;

    const dup = await db.question.findFirst({ where: { organizationId: orgId, stableKey: body.stableKey } });
    if (dup) throw conflict('پرسشی با این شناسه پایدار وجود دارد.', [{ path: 'stableKey', message: 'شناسه تکراری است.' }]);

    const question = await db.question.create({
      data: {
        organizationId: orgId,
        stableKey: body.stableKey,
        categoryId: body.categoryId ?? null,
        title: body.title,
        text: body.text,
        guidance: body.guidance ?? null,
        subjectType: body.subjectType,
        respondentRoles: body.respondentRoles,
        answerType: body.answerType,
        required: body.required,
        weight: body.weight,
        scoring: body.scoring,
        condition: body.condition ?? undefined,
        status: body.status,
        sortOrder: body.sortOrder,
        currentVersion: 1,
      },
    });

    if (body.options.length > 0) {
      const optionRows = body.options as { label: string; value: string; score?: number | null; isNotApplicable: boolean; sortOrder: number }[];
      await db.questionOption.createMany({
        data: optionRows.map((o) => ({
          questionId: question.id,
          label: o.label,
          value: o.value,
          score: o.score ?? null,
          isNotApplicable: o.isNotApplicable,
          sortOrder: o.sortOrder,
        })),
      });
    }

    await createQuestionVersion(question.id, 1, auth.id);
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'question.created', entityType: 'question', entityId: question.id, after: { stableKey: body.stableKey } }, req);
    sendData(res, { id: question.id, version: 1 }, 201);
  }),
);

questionsRouter.get(
  '/:id',
  requirePermission('questions.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const question = await db.question.findFirst({
      where: { id, organizationId: orgId },
      include: { options: { orderBy: { sortOrder: 'asc' } }, category: true, versions: { orderBy: { version: 'desc' }, select: { id: true, version: true, createdAt: true } } },
    });
    if (!question) throw notFound();
    sendData(res, { question });
  }),
);

questionsRouter.patch(
  '/:id',
  requirePermission('questions.edit'),
  validateBody(questionUpdateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const question = await db.question.findFirst({ where: { id, organizationId: orgId } });
    if (!question) throw notFound();

    const body = req.body as Record<string, unknown>;

    await db.question.update({
      where: { id },
      data: {
        ...(body.categoryId !== undefined ? { categoryId: (body.categoryId as number | null) ?? null } : {}),
        ...(body.title !== undefined ? { title: body.title as string } : {}),
        ...(body.text !== undefined ? { text: body.text as string } : {}),
        ...(body.guidance !== undefined ? { guidance: (body.guidance as string) ?? null } : {}),
        ...(body.subjectType !== undefined ? { subjectType: body.subjectType as string } : {}),
        ...(body.respondentRoles !== undefined ? { respondentRoles: body.respondentRoles as string[] } : {}),
        ...(body.answerType !== undefined ? { answerType: body.answerType as string } : {}),
        ...(body.required !== undefined ? { required: body.required as boolean } : {}),
        ...(body.weight !== undefined ? { weight: body.weight as number } : {}),
        ...(body.scoring !== undefined ? { scoring: body.scoring as object } : {}),
        ...(body.condition !== undefined ? { condition: (body.condition as object) ?? undefined } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder as number } : {}),
      },
    });

    if (Array.isArray(body.options)) {
      await db.questionOption.deleteMany({ where: { questionId: id } });
      const options = body.options as { label: string; value: string; score?: number | null; isNotApplicable: boolean; sortOrder: number }[];
      if (options.length > 0) {
        await db.questionOption.createMany({
          data: options.map((o) => ({ questionId: id, label: o.label, value: o.value, score: o.score ?? null, isNotApplicable: o.isNotApplicable, sortOrder: o.sortOrder })),
        });
      }
    }

    // Editing a question mints a new immutable version (historical forms keep vN).
    const nextVersion = question.currentVersion + 1;
    await db.question.update({ where: { id }, data: { currentVersion: nextVersion } });
    await createQuestionVersion(id, nextVersion, auth.id);

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'question.updated', entityType: 'question', entityId: id, after: { version: nextVersion } }, req);
    sendData(res, { ok: true, version: nextVersion });
  }),
);

questionsRouter.post(
  '/:id/archive',
  requirePermission('questions.archive'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const question = await db.question.findFirst({ where: { id, organizationId: orgId } });
    if (!question) throw notFound();
    await db.question.update({ where: { id }, data: { status: 'archived' } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'question.archived', entityType: 'question', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);
