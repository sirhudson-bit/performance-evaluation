import { Router } from 'express';
import { ASSIGNMENT_TRANSITIONS, assertTransition, type AssignmentStatus } from '@pe/shared';
import { saveResponsesSchema, reviewSchema, publishSchema, appealCreateSchema, appealDecideSchema, improvementPlanSchema, reopenSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth, hasPermission } from '../../middleware/auth.js';
import { requireOrganization, resolveEmployeeScope } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';
import { saveResponse, computeAssignmentScores, computeFinalResult } from './service.js';
import type { QuestionSnapshot } from '../forms/service.js';

export const evaluationsRouter = Router();

const SUBMITTED_STATES = ['submitted', 'under_review', 'approved', 'published'];

/** Whether the caller may open/act on this assignment. */
function isEvaluator(authId: number, evaluatorUserId: number | null): boolean {
  return evaluatorUserId !== null && evaluatorUserId === authId;
}

// --- My assignments --------------------------------------------------------
evaluationsRouter.get(
  '/',
  requirePermission('evaluations.view_own'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const items = await db.evaluationAssignment.findMany({
      where: { evaluatorUserId: auth.id },
      include: {
        cycle: { select: { id: true, name: true, status: true, endDate: true, submissionDeadline: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
        responses: { select: { id: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
    sendData(res, {
      items: items.map((a) => ({
        id: a.id,
        status: a.status,
        evaluatorRole: a.evaluatorRole,
        dueDate: a.dueDate,
        cycle: a.cycle,
        employee: a.employee,
        answeredCount: a.responses.length,
      })),
    });
  }),
);

// --- Assignment detail -----------------------------------------------------
evaluationsRouter.get(
  '/:id',
  requirePermission('evaluations.view_own'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const id = Number(req.params.id);
    const assignment = await db.evaluationAssignment.findUnique({
      where: { id },
      include: {
        cycle: true,
        employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
        formVersion: {
          include: {
            sections: { orderBy: { sortOrder: 'asc' }, include: { questions: { orderBy: { sortOrder: 'asc' }, include: { questionVersion: true } } } },
            questions: { orderBy: { sortOrder: 'asc' }, include: { questionVersion: true } },
          },
        },
        responses: true,
      },
    });
    if (!assignment || assignment.organizationId !== auth.organizationId) throw notFound();

    const canViewRaw = hasPermission(auth, 'evaluations.view_raw') || hasPermission(auth, 'assignments.manage');
    if (!isEvaluator(auth.id, assignment.evaluatorUserId) && !canViewRaw) throw notFound();

    const responseByFq = new Map(assignment.responses.map((r) => [r.formQuestionId, r]));

    const sections = assignment.formVersion.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      weight: Number(section.weight),
      questions: section.questions.map((fq) => {
        const snapshot = fq.questionVersion.snapshot as unknown as QuestionSnapshot;
        const response = responseByFq.get(fq.id);
        return {
          formQuestionId: fq.id,
          questionId: fq.questionVersion.questionId,
          title: snapshot.title,
          text: snapshot.text,
          guidance: snapshot.guidance,
          answerType: snapshot.answerType,
          scoring: snapshot.scoring ?? {},
          options: snapshot.options ?? [],
          weight: Number(fq.weight),
          required: fq.required,
          condition: fq.condition,
          answer: response?.value ?? null,
          isNotApplicable: response?.isNotApplicable ?? false,
        };
      }),
    }));

    sendData(res, {
      assignment: { id: assignment.id, status: assignment.status, evaluatorRole: assignment.evaluatorRole, dueDate: assignment.dueDate, submittedAt: assignment.submittedAt },
      cycle: { id: assignment.cycle.id, name: assignment.cycle.name, confidentialityMode: assignment.cycle.confidentialityMode, endDate: assignment.cycle.endDate },
      employee: assignment.employee,
      locked: SUBMITTED_STATES.includes(assignment.status),
      sections,
    });
  }),
);

// --- Save draft ------------------------------------------------------------
evaluationsRouter.put(
  '/:id/responses',
  requirePermission('evaluations.fill'),
  validateBody(saveResponsesSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const id = Number(req.params.id);
    const assignment = await db.evaluationAssignment.findUnique({ where: { id }, include: { formVersion: { include: { questions: { include: { questionVersion: true } } } } } });
    if (!assignment || assignment.organizationId !== auth.organizationId) throw notFound();
    if (!isEvaluator(auth.id, assignment.evaluatorUserId)) throw forbidden('این ارزیابی به شما ارجاع نشده است.');
    if (SUBMITTED_STATES.includes(assignment.status)) throw conflict('پس از ارسال، ویرایش امکان‌پذیر نیست.');

    const { answers } = req.body as { answers: { formQuestionId: number; value: unknown; isNotApplicable: boolean }[] };
    const fqById = new Map(assignment.formVersion.questions.map((q) => [q.id, q]));

    for (const answer of answers) {
      const fq = fqById.get(answer.formQuestionId);
      if (!fq) continue;
      await saveResponse({
        organizationId: assignment.organizationId,
        assignmentId: assignment.id,
        formQuestionId: fq.id,
        questionVersionId: fq.questionVersionId,
        answerType: (fq.questionVersion.snapshot ? (fq.questionVersion.snapshot as unknown as QuestionSnapshot).answerType : 'short_text'),
        snapshot: (fq.questionVersion.snapshot ?? {}) as unknown as QuestionSnapshot,
        value: answer.value,
        isNotApplicable: answer.isNotApplicable,
      });
    }

    if (assignment.status === 'assigned' || assignment.status === 'draft') {
      await db.evaluationAssignment.update({ where: { id }, data: { status: 'in_progress' } });
    }

    sendData(res, { ok: true });
  }),
);

// --- Submit ----------------------------------------------------------------
evaluationsRouter.post(
  '/:id/submit',
  requirePermission('evaluations.submit'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const id = Number(req.params.id);
    const assignment = await db.evaluationAssignment.findUnique({
      where: { id },
      include: { formVersion: { include: { questions: true } }, responses: true },
    });
    if (!assignment || assignment.organizationId !== auth.organizationId) throw notFound();
    if (!isEvaluator(auth.id, assignment.evaluatorUserId)) throw forbidden('این ارزیابی به شما ارجاع نشده است.');

    try {
      assertTransition(ASSIGNMENT_TRANSITIONS, assignment.status as AssignmentStatus, 'submitted', 'وضعیت ارزیابی');
    } catch (error) {
      throw conflict(error instanceof Error ? error.message : 'گذار وضعیت نامعتبر است.');
    }

    const responseByFq = new Map(assignment.responses.map((r) => [r.formQuestionId, r]));
    const missing: string[] = [];
    for (const fq of assignment.formVersion.questions) {
      if (!fq.required) continue;
      const r = responseByFq.get(fq.id);
      const answered = r && r.value !== null && r.value !== undefined && !(typeof r.value === 'string' && r.value.trim() === '');
      if (!r || (!answered && !r.isNotApplicable)) missing.push(String(fq.id));
    }
    if (missing.length > 0) throw badRequest('پرسش‌های الزامی پاسخ داده نشده‌اند.', { count: missing.length });

    await db.$transaction(async () => {
      await db.evaluationAssignment.update({ where: { id }, data: { status: 'submitted', submittedAt: new Date() } });
    });
    await computeAssignmentScores(id);

    await recordAudit({ organizationId: assignment.organizationId, actorUserId: auth.id, action: 'assignment.submitted', entityType: 'evaluation_assignment', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);

// --- Review / approve / return ---------------------------------------------
evaluationsRouter.post(
  '/:id/review',
  requirePermission('evaluations.review'),
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const id = Number(req.params.id);
    const assignment = await db.evaluationAssignment.findUnique({ where: { id } });
    if (!assignment || assignment.organizationId !== auth.organizationId) throw notFound();

    const { action, comment } = req.body as { action: 'review' | 'approve' | 'return'; comment?: string };
    const target: AssignmentStatus = action === 'approve' ? 'approved' : action === 'return' ? 'returned_for_revision' : 'under_review';

    if (action === 'approve' && !hasPermission(auth, 'evaluations.approve')) throw forbidden();
    if (action === 'return' && !hasPermission(auth, 'evaluations.return')) throw forbidden();

    try {
      assertTransition(ASSIGNMENT_TRANSITIONS, assignment.status as AssignmentStatus, target, 'وضعیت ارزیابی');
    } catch (error) {
      throw conflict(error instanceof Error ? error.message : 'گذار وضعیت نامعتبر است.');
    }

    await db.$transaction([
      db.evaluationAssignment.update({ where: { id }, data: { status: target } }),
      db.evaluationReview.create({
        data: { organizationId: assignment.organizationId, assignmentId: id, reviewerId: auth.id, action, comment: comment ?? null, fromStatus: assignment.status, toStatus: target },
      }),
    ]);

    await recordAudit({ organizationId: assignment.organizationId, actorUserId: auth.id, action: `assignment.${action}`, entityType: 'evaluation_assignment', entityId: id, after: { status: target } }, req);

    // If every assignment for this employee is approved and the cycle auto-publishes
    // is not set, we simply leave it approved; publishing is an explicit step.
    sendData(res, { ok: true, status: target });
  }),
);

// --- Reopen ----------------------------------------------------------------
evaluationsRouter.post(
  '/:id/reopen',
  requirePermission('evaluations.reopen'),
  validateBody(reopenSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const id = Number(req.params.id);
    const assignment = await db.evaluationAssignment.findUnique({ where: { id } });
    if (!assignment || assignment.organizationId !== auth.organizationId) throw notFound();
    if (!['published', 'approved'].includes(assignment.status)) throw conflict('فقط ارزیابی منتشرشده یا تأییدشده قابل بازگشایی است.');

    const { reason } = req.body as { reason: string };
    await db.evaluationAssignment.update({ where: { id }, data: { status: 'reopened' } });
    await recordAudit({ organizationId: assignment.organizationId, actorUserId: auth.id, action: 'assignment.reopened', entityType: 'evaluation_assignment', entityId: id, after: { reason } }, req);
    sendData(res, { ok: true });
  }),
);

// --- Publish results -------------------------------------------------------
evaluationsRouter.post(
  '/publish',
  requirePermission('evaluations.publish'),
  validateBody(publishSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { cycleId, employeeIds } = req.body as { cycleId?: number; employeeIds?: number[]; reason?: string };
    if (!cycleId) throw badRequest('شناسه دوره الزامی است.');

    const cycle = await db.evaluationCycle.findFirst({ where: { id: cycleId, organizationId: orgId } });
    if (!cycle) throw notFound();

    const assignments = await db.evaluationAssignment.findMany({
      where: { cycleId, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      select: { employeeId: true, status: true },
    });
    const employeeIdSet = [...new Set(assignments.map((a) => a.employeeId))];

    const published: number[] = [];
    const blocked: { employeeId: number; reason: string }[] = [];

    for (const employeeId of employeeIdSet) {
      const incomplete = assignments.filter((a) => a.employeeId === employeeId && !SUBMITTED_STATES.includes(a.status));
      if (incomplete.length > 0) {
        blocked.push({ employeeId, reason: 'مراحل ارزیابی تکمیل نشده است.' });
        continue;
      }
      const result = await computeFinalResult(cycleId, employeeId);
      if (!result.complete) {
        blocked.push({ employeeId, reason: 'برخی ارزیابان ارزیابی خود را ارسال نکرده‌اند.' });
        continue;
      }
      await db.finalEvaluationResult.update({
        where: { cycleId_employeeId: { cycleId, employeeId } },
        data: { status: 'published', publishedAt: new Date(), publishedBy: auth.id },
      });
      await db.evaluationAssignment.updateMany({ where: { cycleId, employeeId, status: 'approved' }, data: { status: 'published' } });
      published.push(employeeId);
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'results.published', entityType: 'evaluation_cycle', entityId: cycleId, after: { published: published.length, blocked: blocked.length } }, req);
    sendData(res, { published, blocked });
  }),
);

// --- Results ---------------------------------------------------------------
evaluationsRouter.get(
  '/results/list',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const cycleId = req.query.cycleId ? Number(req.query.cycleId) : undefined;
    const scope = await resolveEmployeeScope(auth);

    const isSelfOnly = !scope.seesAll && scope.employeeIds.length <= 1;
    const items = await db.finalEvaluationResult.findMany({
      where: {
        organizationId: orgId,
        ...(cycleId ? { cycleId } : {}),
        ...(scope.seesAll ? {} : { employeeId: { in: scope.employeeIds } }),
        ...(isSelfOnly ? { status: 'published' } : {}),
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } }, cycle: { select: { id: true, name: true } } },
      orderBy: { finalScore: 'desc' },
    });
    sendData(res, { items });
  }),
);

// --- Appeals ---------------------------------------------------------------
evaluationsRouter.get(
  '/appeals/list',
  requirePermission('appeals.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const scope = await resolveEmployeeScope(auth);
    const items = await db.appealRequest.findMany({
      where: { organizationId: orgId, ...(scope.seesAll ? {} : { employeeId: { in: scope.employeeIds } }) },
      include: { employee: { select: { id: true, firstName: true, lastName: true } }, cycle: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    sendData(res, { items });
  }),
);

evaluationsRouter.post(
  '/appeals',
  requirePermission('appeals.submit'),
  validateBody(appealCreateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { cycleId, reason } = req.body as { cycleId?: number; reason: string };
    if (!cycleId) throw badRequest('شناسه دوره الزامی است.');

    const cycle = await db.evaluationCycle.findFirst({ where: { id: cycleId, organizationId: orgId } });
    if (!cycle) throw notFound();
    if (!cycle.appealEnabled) throw conflict('امکان ثبت اعتراض برای این دوره فعال نیست.');

    const own = await db.employee.findFirst({ where: { userId: auth.id }, select: { id: true } });
    if (!own) throw badRequest('حساب کاربری به پرونده کارمندی متصل نیست.');

    const result = await db.finalEvaluationResult.findUnique({ where: { cycleId_employeeId: { cycleId, employeeId: own.id } } });
    if (!result || result.status !== 'published') throw conflict('نتیجه منتشرشده‌ای برای اعتراض وجود ندارد.');

    const appeal = await db.appealRequest.create({
      data: { organizationId: orgId, cycleId, employeeId: own.id, reason, status: 'open', scoreBefore: result.finalScore },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'appeal.created', entityType: 'appeal_request', entityId: appeal.id }, req);
    sendData(res, { id: appeal.id }, 201);
  }),
);

evaluationsRouter.post(
  '/appeals/:id/decide',
  requirePermission('appeals.manage'),
  validateBody(appealDecideSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const appeal = await db.appealRequest.findFirst({ where: { id, organizationId: orgId } });
    if (!appeal) throw notFound();

    const { decision, reason, scoreAfter } = req.body as { decision: 'accepted' | 'rejected'; reason: string; scoreAfter?: number | null };

    // The original result is never deleted — an accepted appeal records a new
    // score alongside the previous one.
    await db.$transaction(async (tx) => {
      await tx.appealRequest.update({
        where: { id },
        data: { status: decision, reviewerId: auth.id, decision: reason, decidedAt: new Date(), scoreAfter: scoreAfter ?? appeal.scoreBefore },
      });
      if (decision === 'accepted' && scoreAfter != null) {
        await tx.finalEvaluationResult.update({
          where: { cycleId_employeeId: { cycleId: appeal.cycleId, employeeId: appeal.employeeId } },
          data: { finalScore: scoreAfter, status: 'appealed' },
        });
      }
    });

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'appeal.decided', entityType: 'appeal_request', entityId: id, after: { decision, scoreAfter } }, req);
    sendData(res, { ok: true });
  }),
);

// --- Improvement plans -----------------------------------------------------
export const improvementPlansRouter = Router();

improvementPlansRouter.get(
  '/',
  requirePermission('improvement_plans.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const scope = await resolveEmployeeScope(auth);
    const items = await db.improvementPlan.findMany({
      where: { organizationId: orgId, ...(scope.seesAll ? {} : { employeeId: { in: scope.employeeIds } }) },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    sendData(res, { items });
  }),
);

improvementPlansRouter.post(
  '/',
  requirePermission('improvement_plans.manage'),
  validateBody(improvementPlanSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { employeeId: number; cycleId?: number | null; title: string; actions: unknown[]; status: string; dueDate?: Date };

    const employee = await db.employee.findFirst({ where: { id: body.employeeId, organizationId: orgId } });
    if (!employee) throw badRequest('کارمند یافت نشد.');

    const plan = await db.improvementPlan.create({
      data: {
        organizationId: orgId,
        employeeId: body.employeeId,
        cycleId: body.cycleId ?? null,
        title: body.title,
        actions: body.actions as object[],
        status: body.status,
        dueDate: body.dueDate ?? null,
        ownerUserId: auth.id,
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'improvement_plan.created', entityType: 'improvement_plan', entityId: plan.id }, req);
    sendData(res, { id: plan.id }, 201);
  }),
);

improvementPlansRouter.patch(
  '/:id',
  requirePermission('improvement_plans.manage'),
  validateBody(improvementPlanSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const plan = await db.improvementPlan.findFirst({ where: { id, organizationId: orgId } });
    if (!plan) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.improvementPlan.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title as string } : {}),
        ...(body.actions !== undefined ? { actions: body.actions as object[] } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
        ...(body.dueDate !== undefined ? { dueDate: (body.dueDate as Date) ?? null } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

improvementPlansRouter.delete(
  '/:id',
  requirePermission('improvement_plans.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const plan = await db.improvementPlan.findFirst({ where: { id, organizationId: orgId } });
    if (!plan) throw notFound();
    await db.improvementPlan.delete({ where: { id } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'improvement_plan.deleted', entityType: 'improvement_plan', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);
