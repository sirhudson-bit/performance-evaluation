import { Router } from 'express';
import { formSchema, sectionSchema, formQuestionSchema, formQuestionUpdateSchema, reorderSchema, formVersionUpdateSchema, scoringPreviewSchema } from '@pe/validation';
import { validateAndNormalizeWeights } from './validate.js';
import { db } from '../../db.js';
import { asyncHandler, badRequest, conflict, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';
import { previewVersionScoring } from './service.js';

export const formsRouter = Router();

async function loadVersionInOrg(versionId: number, orgId: number) {
  const version = await db.formVersion.findFirst({ where: { id: versionId, form: { organizationId: orgId } } });
  if (!version) throw notFound();
  return version;
}

// --- Forms -----------------------------------------------------------------
formsRouter.get(
  '/',
  requirePermission('forms.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.evaluationForm.findMany({
      where: { organizationId: orgId },
      include: { versions: { select: { id: true, version: true, status: true, publishedAt: true }, orderBy: { version: 'desc' } } },
      orderBy: { id: 'desc' },
    });
    sendData(res, { items });
  }),
);

formsRouter.post(
  '/',
  requirePermission('forms.create'),
  validateBody(formSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { name: string; description?: string };
    const form = await db.evaluationForm.create({ data: { organizationId: orgId, name: body.name, description: body.description ?? null, status: 'draft' } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'form.created', entityType: 'evaluation_form', entityId: form.id, after: body }, req);
    sendData(res, { id: form.id }, 201);
  }),
);

formsRouter.get(
  '/:id',
  requirePermission('forms.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const form = await db.evaluationForm.findFirst({
      where: { id, organizationId: orgId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!form) throw notFound();
    sendData(res, { form });
  }),
);

// --- Versions --------------------------------------------------------------
formsRouter.post(
  '/:id/versions',
  requirePermission('forms.edit'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const formId = Number(req.params.id);
    const form = await db.evaluationForm.findFirst({ where: { id: formId, organizationId: orgId } });
    if (!form) throw notFound();

    const latest = await db.formVersion.findFirst({ where: { formId }, orderBy: { version: 'desc' } });
    const nextVersion = (latest?.version ?? 0) + 1;

    const version = await db.formVersion.create({
      data: {
        formId,
        version: nextVersion,
        status: 'draft',
        scoringPolicyId: latest?.scoringPolicyId ?? null,
        confidentialityMode: latest?.confidentialityMode ?? 'named',
        selfAssessment: latest?.selfAssessment ?? false,
        anonymityThreshold: latest?.anonymityThreshold ?? 3,
        createdBy: auth.id,
      },
    });

    // Copy the previous version's structure so a new draft starts from it.
    if (latest) {
      const sections = await db.formSection.findMany({ where: { formVersionId: latest.id }, orderBy: { sortOrder: 'asc' } });
      const sectionMap = new Map<number, number>();
      for (const s of sections) {
        const copy = await db.formSection.create({ data: { formVersionId: version.id, title: s.title, description: s.description, weight: s.weight, sortOrder: s.sortOrder } });
        sectionMap.set(s.id, copy.id);
      }
      const questions = await db.formQuestion.findMany({ where: { formVersionId: latest.id }, orderBy: { sortOrder: 'asc' } });
      for (const q of questions) {
        const newSectionId = sectionMap.get(q.sectionId);
        if (!newSectionId) continue;
        await db.formQuestion.create({ data: { formVersionId: version.id, sectionId: newSectionId, questionVersionId: q.questionVersionId, weight: q.weight, required: q.required, sortOrder: q.sortOrder, condition: q.condition ?? undefined } });
      }
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'form_version.created', entityType: 'form_version', entityId: version.id }, req);
    sendData(res, { id: version.id, version: nextVersion }, 201);
  }),
);

formsRouter.get(
  '/versions/:vid',
  requirePermission('forms.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const version = await loadVersionInOrg(Number(req.params.vid), orgId);
    const full = await db.formVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: {
        form: { select: { id: true, name: true } },
        scoringPolicy: true,
        sections: { orderBy: { sortOrder: 'asc' }, include: { questions: { orderBy: { sortOrder: 'asc' }, include: { questionVersion: { include: { question: { select: { id: true, stableKey: true, status: true } } } } } } } },
        questions: { include: { questionVersion: true } },
      },
    });
    sendData(res, { version: full });
  }),
);

formsRouter.patch(
  '/versions/:vid',
  requirePermission('forms.edit'),
  validateBody(formVersionUpdateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const version = await loadVersionInOrg(Number(req.params.vid), orgId);
    if (version.status === 'published') throw conflict('نسخه منتشرشده قابل ویرایش نیست؛ نسخه جدید بسازید.');
    const body = req.body as Record<string, unknown>;
    await db.formVersion.update({
      where: { id: version.id },
      data: {
        ...(body.confidentialityMode !== undefined ? { confidentialityMode: body.confidentialityMode as string } : {}),
        ...(body.selfAssessment !== undefined ? { selfAssessment: body.selfAssessment as boolean } : {}),
        ...(body.anonymityThreshold !== undefined ? { anonymityThreshold: body.anonymityThreshold as number } : {}),
        ...(body.scoringPolicyId !== undefined ? { scoringPolicyId: (body.scoringPolicyId as number | null) ?? null } : {}),
        ...(body.notes !== undefined ? { notes: (body.notes as string) ?? null } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

// --- Sections --------------------------------------------------------------
formsRouter.post(
  '/versions/:vid/sections',
  requirePermission('forms.edit'),
  validateBody(sectionSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const version = await loadVersionInOrg(Number(req.params.vid), orgId);
    if (version.status === 'published') throw conflict('نسخه منتشرشده قابل ویرایش نیست.');
    const body = req.body as { title: string; description?: string; weight: number; sortOrder: number };
    const section = await db.formSection.create({ data: { formVersionId: version.id, title: body.title, description: body.description ?? null, weight: body.weight, sortOrder: body.sortOrder } });
    sendData(res, { id: section.id }, 201);
  }),
);

formsRouter.patch(
  '/sections/:sid',
  requirePermission('forms.edit'),
  validateBody(sectionSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const section = await db.formSection.findFirst({ where: { id: Number(req.params.sid), formVersion: { form: { organizationId: orgId } } } });
    if (!section) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.formSection.update({
      where: { id: section.id },
      data: {
        ...(body.title !== undefined ? { title: body.title as string } : {}),
        ...(body.description !== undefined ? { description: (body.description as string) ?? null } : {}),
        ...(body.weight !== undefined ? { weight: body.weight as number } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder as number } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

formsRouter.delete(
  '/sections/:sid',
  requirePermission('forms.edit'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const section = await db.formSection.findFirst({ where: { id: Number(req.params.sid), formVersion: { form: { organizationId: orgId } } } });
    if (!section) throw notFound();
    await db.formSection.delete({ where: { id: section.id } });
    sendData(res, { ok: true });
  }),
);

// --- Form questions --------------------------------------------------------
formsRouter.post(
  '/versions/:vid/questions',
  requirePermission('forms.edit'),
  validateBody(formQuestionSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const version = await loadVersionInOrg(Number(req.params.vid), orgId);
    if (version.status === 'published') throw conflict('نسخه منتشرشده قابل ویرایش نیست.');
    const body = req.body as { sectionId: number; questionId: number; weight: number; required: boolean; sortOrder: number; condition?: object | null };

    const question = await db.question.findFirst({ where: { id: body.questionId, organizationId: orgId } });
    if (!question) throw badRequest('پرسش یافت نشد.');
    const latestVersion = await db.questionVersion.findFirst({ where: { questionId: question.id }, orderBy: { version: 'desc' } });
    if (!latestVersion) throw badRequest('نسخه‌ای برای این پرسش ثبت نشده است.');

    const section = await db.formSection.findFirst({ where: { id: body.sectionId, formVersionId: version.id } });
    if (!section) throw badRequest('بخش انتخاب‌شده معتبر نیست.');

    const fq = await db.formQuestion.create({
      data: { formVersionId: version.id, sectionId: body.sectionId, questionVersionId: latestVersion.id, weight: body.weight, required: body.required, sortOrder: body.sortOrder, condition: body.condition ?? undefined },
    });
    sendData(res, { id: fq.id }, 201);
  }),
);

formsRouter.patch(
  '/form-questions/:fqid',
  requirePermission('forms.edit'),
  validateBody(formQuestionUpdateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const fq = await db.formQuestion.findFirst({ where: { id: Number(req.params.fqid), formVersion: { form: { organizationId: orgId } } } });
    if (!fq) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.formQuestion.update({
      where: { id: fq.id },
      data: {
        ...(body.weight !== undefined ? { weight: body.weight as number } : {}),
        ...(body.required !== undefined ? { required: body.required as boolean } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder as number } : {}),
        ...(body.condition !== undefined ? { condition: (body.condition as object) ?? undefined } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

formsRouter.delete(
  '/form-questions/:fqid',
  requirePermission('forms.edit'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const fq = await db.formQuestion.findFirst({ where: { id: Number(req.params.fqid), formVersion: { form: { organizationId: orgId } } } });
    if (!fq) throw notFound();
    await db.formQuestion.delete({ where: { id: fq.id } });
    sendData(res, { ok: true });
  }),
);

// --- Reorder ---------------------------------------------------------------
formsRouter.post(
  '/versions/:vid/reorder/sections',
  requirePermission('forms.edit'),
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const version = await loadVersionInOrg(Number(req.params.vid), orgId);
    const { orderedIds } = req.body as { orderedIds: number[] };
    await db.$transaction(orderedIds.map((id, index) => db.formSection.updateMany({ where: { id, formVersionId: version.id }, data: { sortOrder: index } })));
    sendData(res, { ok: true });
  }),
);

formsRouter.post(
  '/versions/:vid/reorder/questions',
  requirePermission('forms.edit'),
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const version = await loadVersionInOrg(Number(req.params.vid), orgId);
    const { orderedIds } = req.body as { orderedIds: number[] };
    await db.$transaction(orderedIds.map((id, index) => db.formQuestion.updateMany({ where: { id, formVersionId: version.id }, data: { sortOrder: index } })));
    sendData(res, { ok: true });
  }),
);

// --- Preview ---------------------------------------------------------------
formsRouter.post(
  '/versions/:vid/preview',
  requirePermission('forms.view'),
  validateBody(scoringPreviewSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const version = await loadVersionInOrg(Number(req.params.vid), orgId);
    const { answers } = req.body as { answers: { questionId: number; value: unknown; isNotApplicable: boolean }[] };
    const preview = await previewVersionScoring(version.id, answers);
    sendData(res, preview);
  }),
);

// --- Publish ---------------------------------------------------------------
formsRouter.post(
  '/versions/:vid/publish',
  requirePermission('forms.publish'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const version = await loadVersionInOrg(Number(req.params.vid), orgId);
    if (version.status === 'published') throw conflict('این نسخه قبلاً منتشر شده است.');

    const sections = await db.formSection.findMany({ where: { formVersionId: version.id }, include: { questions: true } });
    if (sections.length === 0) throw badRequest('برای انتشار، حداقل یک بخش و یک پرسش لازم است.');
    if (sections.every((s) => s.questions.length === 0)) throw badRequest('هیچ پرسشی در فرم وجود ندارد.');

    // Weight validation (warnings are returned; publishing is blocked only on
    // genuinely invalid weights).
    const sectionWeights = sections.map((s) => Number(s.weight));
    const questionWeightErrors: string[] = [];
    const warnings = validateAndNormalizeWeights(sectionWeights, sections, questionWeightErrors);
    if (questionWeightErrors.length > 0) throw badRequest(questionWeightErrors.join(' '));

    await db.$transaction([
      db.formVersion.update({ where: { id: version.id }, data: { status: 'published', publishedAt: new Date() } }),
      db.evaluationForm.update({ where: { id: version.formId }, data: { status: 'published', currentVersion: version.version } }),
    ]);

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'form_version.published', entityType: 'form_version', entityId: version.id, after: { version: version.version } }, req);
    sendData(res, { ok: true, warnings });
  }),
);

// --- Delete / archive a form ----------------------------------------------
formsRouter.delete(
  '/:id',
  requirePermission('forms.archive'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const form = await db.evaluationForm.findFirst({ where: { id, organizationId: orgId } });
    if (!form) throw notFound();

    // A form used by a cycle cannot be deleted without destroying history — archive it.
    const inUse = await db.evaluationCycle.count({ where: { formVersion: { formId: id } } });
    if (inUse > 0) {
      await db.$transaction([
        db.evaluationForm.update({ where: { id }, data: { status: 'archived' } }),
        db.formVersion.updateMany({ where: { formId: id }, data: { status: 'archived' } }),
      ]);
      await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'form.archived', entityType: 'evaluation_form', entityId: id }, req);
      sendData(res, { ok: true, archived: true });
      return;
    }

    await db.evaluationForm.delete({ where: { id } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'form.deleted', entityType: 'evaluation_form', entityId: id }, req);
    sendData(res, { ok: true, archived: false });
  }),
);
