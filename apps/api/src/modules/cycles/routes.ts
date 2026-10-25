import { Router } from 'express';
import { CYCLE_TRANSITIONS, assertTransition, type CycleStatus } from '@pe/shared';
import { periodSchema, cycleSchema, cycleStatusSchema, bulkAssignSchema, cycleStepSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, badRequest, conflict, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const cyclesRouter = Router();

// --- Periods ---------------------------------------------------------------
cyclesRouter.get(
  '/periods',
  requirePermission('cycles.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.evaluationPeriod.findMany({ where: { organizationId: orgId }, orderBy: { startDate: 'desc' } });
    sendData(res, { items });
  }),
);

cyclesRouter.post(
  '/periods',
  requirePermission('cycles.create'),
  validateBody(periodSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { name: string; type: string; startDate: Date; endDate: Date; status: string };
    if (body.endDate < body.startDate) throw badRequest('تاریخ پایان باید بعد از تاریخ شروع باشد.');
    const period = await db.evaluationPeriod.create({ data: { organizationId: orgId, name: body.name, type: body.type, startDate: body.startDate, endDate: body.endDate, status: body.status } });
    sendData(res, { id: period.id }, 201);
  }),
);

// --- Cycles ----------------------------------------------------------------
cyclesRouter.get(
  '/',
  requirePermission('cycles.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.evaluationCycle.findMany({
      where: { organizationId: orgId },
      include: { formVersion: { include: { form: { select: { name: true } } } }, period: true, _count: { select: { assignments: true, results: true } } },
      orderBy: { startDate: 'desc' },
    });
    sendData(res, { items });
  }),
);

cyclesRouter.post(
  '/',
  requirePermission('cycles.create'),
  validateBody(cycleSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body;

    const formVersion = await db.formVersion.findFirst({ where: { id: body.formVersionId, form: { organizationId: orgId } } });
    if (!formVersion) throw badRequest('نسخه فرم انتخاب‌شده معتبر نیست.');
    if (formVersion.status !== 'published') throw badRequest('فقط نسخه منتشرشده فرم قابل استفاده در دوره است.');
    if (body.endDate < body.startDate) throw badRequest('تاریخ پایان دوره باید بعد از شروع باشد.');

    const cycle = await db.evaluationCycle.create({
      data: {
        organizationId: orgId,
        name: body.name,
        periodId: body.periodId ?? null,
        formVersionId: body.formVersionId,
        workflowId: body.workflowId ?? null,
        scoringPolicyId: body.scoringPolicyId ?? formVersion.scoringPolicyId,
        compensationPolicyId: body.compensationPolicyId ?? null,
        processId: body.processId ?? null,
        confidentialityMode: body.confidentialityMode,
        selfAssessment: body.selfAssessment,
        appealEnabled: body.appealEnabled,
        startDate: body.startDate,
        endDate: body.endDate,
        submissionDeadline: body.submissionDeadline ?? null,
        publicationRule: body.publicationRule,
        config: body.config,
        status: 'draft',
        createdBy: auth.id,
      },
    });

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'cycle.created', entityType: 'evaluation_cycle', entityId: cycle.id, after: { name: cycle.name } }, req);
    sendData(res, { id: cycle.id }, 201);
  }),
);

cyclesRouter.get(
  '/:id',
  requirePermission('cycles.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const cycle = await db.evaluationCycle.findFirst({
      where: { id: Number(req.params.id), organizationId: orgId },
      include: { formVersion: { include: { form: true, sections: true } }, period: true, results: true },
    });
    if (!cycle) throw notFound();
    sendData(res, { cycle });
  }),
);

cyclesRouter.patch(
  '/:id',
  requirePermission('cycles.edit'),
  validateBody(cycleSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const cycle = await db.evaluationCycle.findFirst({ where: { id, organizationId: orgId } });
    if (!cycle) throw notFound();
    if (['published', 'closed'].includes(cycle.status)) throw conflict('دوره منتشرشده/بسته‌شده قابل ویرایش نیست.');

    const body = req.body as Record<string, unknown>;
    await db.evaluationCycle.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.endDate !== undefined ? { endDate: body.endDate as Date } : {}),
        ...(body.submissionDeadline !== undefined ? { submissionDeadline: (body.submissionDeadline as Date) ?? null } : {}),
        ...(body.appealEnabled !== undefined ? { appealEnabled: body.appealEnabled as boolean } : {}),
        ...(body.selfAssessment !== undefined ? { selfAssessment: body.selfAssessment as boolean } : {}),
        ...(body.publicationRule !== undefined ? { publicationRule: body.publicationRule as string } : {}),
        ...(body.compensationPolicyId !== undefined ? { compensationPolicyId: (body.compensationPolicyId as number | null) ?? null } : {}),
        ...(body.config !== undefined ? { config: body.config as object } : {}),
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'cycle.updated', entityType: 'evaluation_cycle', entityId: id, after: body }, req);
    sendData(res, { ok: true });
  }),
);

cyclesRouter.post(
  '/:id/status',
  requirePermission('cycles.edit'),
  validateBody(cycleStatusSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const cycle = await db.evaluationCycle.findFirst({ where: { id, organizationId: orgId } });
    if (!cycle) throw notFound();

    const { status } = req.body as { status: CycleStatus; reason?: string };
    // Server-side transition validation (invalid transitions are rejected).
    try {
      assertTransition(CYCLE_TRANSITIONS, cycle.status as CycleStatus, status, 'وضعیت دوره');
    } catch (error) {
      throw conflict(error instanceof Error ? error.message : 'گذار وضعیت نامعتبر است.');
    }

    if (status === 'active' && cycle.selfAssessment === undefined) throw badRequest('تنظیمات ناقص است.');

    await db.evaluationCycle.update({ where: { id }, data: { status } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'cycle.status_changed', entityType: 'evaluation_cycle', entityId: id, before: { status: cycle.status }, after: { status } }, req);
    sendData(res, { ok: true, status });
  }),
);

// --- Assignments -----------------------------------------------------------
cyclesRouter.get(
  '/:id/assignments',
  requirePermission('assignments.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const cycle = await db.evaluationCycle.findFirst({ where: { id, organizationId: orgId } });
    if (!cycle) throw notFound();
    const items = await db.evaluationAssignment.findMany({
      where: { cycleId: id },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } }, scores: true, responses: { select: { id: true } } },
      orderBy: { id: 'asc' },
    });
    sendData(res, { items });
  }),
);

cyclesRouter.post(
  '/:id/assignments',
  requirePermission('assignments.manage'),
  validateBody(bulkAssignSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const cycleId = Number(req.params.id);
    const cycle = await db.evaluationCycle.findFirst({ where: { id: cycleId, organizationId: orgId } });
    if (!cycle) throw notFound();
    if (['published', 'closed', 'cancelled'].includes(cycle.status)) throw conflict('در این وضعیت امکان ارجاع وجود ندارد.');

    const body = req.body as { employeeIds: number[]; evaluatorRoles: string[]; strategy: 'manager_history' | 'current_manager'; weights?: Record<string, number>; dueDate?: Date };

    const employees = await db.employee.findMany({ where: { id: { in: body.employeeIds }, organizationId: orgId }, include: { user: { select: { id: true } } } });
    const hrUser = await db.user.findFirst({ where: { organizationId: orgId, roles: { some: { role: { key: 'hr_manager' } } } }, select: { id: true } });

    let created = 0;
    const skipped: string[] = [];

    for (const employee of employees) {
      for (const role of body.evaluatorRoles) {
        let evaluatorUserId: number | null = null;
        let evaluatorEmployeeId: number | null = null;

        if (role === 'self') {
          evaluatorUserId = employee.user?.id ?? null;
          evaluatorEmployeeId = employee.id;
          if (!evaluatorUserId) {
            if (!cycle.selfAssessment) continue;
            skipped.push(`${employee.employeeNo}: کاربری برای خودارزیابی متصل نیست.`);
            continue;
          }
        } else if (role === 'manager') {
          const managerId = await resolveManager(orgId, employee.id, cycle.startDate, body.strategy);
          const manager = managerId ? await db.employee.findUnique({ where: { id: managerId }, include: { user: { select: { id: true } } } }) : null;
          evaluatorEmployeeId = manager?.id ?? null;
          evaluatorUserId = manager?.user?.id ?? null;
          if (!manager || !evaluatorUserId) {
            skipped.push(`${employee.employeeNo}: مدیر مستقیم دارای حساب کاربری یافت نشد.`);
            continue;
          }
        } else if (role === 'hr') {
          evaluatorUserId = hrUser?.id ?? null;
          if (!evaluatorUserId) {
            skipped.push('کاربر منابع انسانی یافت نشد.');
            continue;
          }
        } else {
          skipped.push(`${employee.employeeNo}: نقش «${role}» نیازمند ارجاع دستی است.`);
          continue;
        }

        const weight = body.weights?.[role] ?? 0;

        // Idempotent-ish: skip an identical assignment that already exists.
        const existing = await db.evaluationAssignment.findFirst({
          where: { cycleId, employeeId: employee.id, evaluatorRole: role, evaluatorUserId },
        });
        if (existing) continue;

        await db.evaluationAssignment.create({
          data: {
            organizationId: orgId,
            cycleId,
            employeeId: employee.id,
            evaluatorRole: role,
            evaluatorUserId,
            evaluatorEmployeeId,
            weight,
            status: 'assigned',
            dueDate: body.dueDate ?? cycle.submissionDeadline ?? cycle.endDate,
            formVersionId: cycle.formVersionId,
          },
        });
        created += 1;
      }
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'assignments.created', entityType: 'evaluation_cycle', entityId: cycleId, after: { created, roles: body.evaluatorRoles } }, req);
    sendData(res, { created, skipped }, 201);
  }),
);

cyclesRouter.delete(
  '/:id/assignments/:aid',
  requirePermission('assignments.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const cycleId = Number(req.params.id);
    const aid = Number(req.params.aid);
    const assignment = await db.evaluationAssignment.findFirst({ where: { id: aid, cycleId, organizationId: orgId } });
    if (!assignment) throw notFound();
    if (['submitted', 'under_review', 'approved', 'published'].includes(assignment.status)) {
      throw conflict('ارجاع دارای پاسخ ارسال‌شده قابل حذف نیست.');
    }
    await db.evaluationAssignment.delete({ where: { id: aid } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'assignment.deleted', entityType: 'evaluation_assignment', entityId: aid }, req);
    sendData(res, { ok: true });
  }),
);

// --- Dashboard -------------------------------------------------------------
cyclesRouter.get(
  '/:id/dashboard',
  requirePermission('cycles.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const cycleId = Number(req.params.id);
    const cycle = await db.evaluationCycle.findFirst({ where: { id: cycleId, organizationId: orgId } });
    if (!cycle) throw notFound();

    const grouped = await db.evaluationAssignment.groupBy({ by: ['status'], where: { cycleId }, _count: { _all: true } });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.status] = g._count._all;

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const submitted = (counts.submitted ?? 0) + (counts.under_review ?? 0) + (counts.approved ?? 0) + (counts.published ?? 0);
    const overdue = await db.evaluationAssignment.count({ where: { cycleId, dueDate: { lt: new Date() }, status: { in: ['assigned', 'in_progress'] } } });

    sendData(res, {
      status: cycle.status,
      total,
      counts,
      completionRate: total > 0 ? Math.round((submitted / total) * 1000) / 10 : 0,
      overdue,
    });
  }),
);

async function resolveManager(organizationId: number, employeeId: number, asOf: Date, strategy: 'manager_history' | 'current_manager'): Promise<number | null> {
  if (strategy === 'current_manager') {
    const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { managerId: true } });
    return employee?.managerId ?? null;
  }
  const history = await db.employeeManagerHistory.findFirst({
    where: { organizationId, employeeId, effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }] },
    orderBy: { effectiveFrom: 'desc' },
  });
  return history?.managerEmployeeId ?? null;
}

// --- Cycle schedule (steps) ------------------------------------------------
cyclesRouter.get(
  '/:id/steps',
  requirePermission('cycles.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const cycle = await db.evaluationCycle.findFirst({ where: { id, organizationId: orgId } });
    if (!cycle) throw notFound();
    const items = await db.cycleStep.findMany({ where: { cycleId: id }, orderBy: { order: 'asc' } });
    sendData(res, { items });
  }),
);

cyclesRouter.post(
  '/:id/steps',
  requirePermission('cycles.edit'),
  validateBody(cycleStepSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const cycle = await db.evaluationCycle.findFirst({ where: { id, organizationId: orgId } });
    if (!cycle) throw notFound();
    const body = req.body as Record<string, unknown>;
    const row = await db.cycleStep.create({
      data: {
        cycleId: id,
        processStepId: (body.processStepId as number | null) ?? null,
        name: body.name as string,
        order: body.order as number,
        ownerRoleKey: (body.ownerRoleKey as string) ?? null,
        ownerUserId: (body.ownerUserId as number | null) ?? null,
        dueDate: (body.dueDate as Date) ?? null,
        status: body.status as string,
      },
    });
    sendData(res, { id: row.id }, 201);
  }),
);

/** Generates the cycle schedule from the linked process's steps. */
cyclesRouter.post(
  '/:id/steps/from-process',
  requirePermission('cycles.edit'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const cycle = await db.evaluationCycle.findFirst({ where: { id, organizationId: orgId } });
    if (!cycle) throw notFound();
    if (!cycle.processId) throw conflict('این دوره به هیچ فرایندی متصل نیست.');
    const process = await db.performanceProcess.findUniqueOrThrow({ where: { id: cycle.processId }, include: { steps: { orderBy: { order: 'asc' } } } });
    if (process.steps.length === 0) throw conflict('فرایند انتخابی مرحله‌ای ندارد.');

    await db.cycleStep.deleteMany({ where: { cycleId: id } });
    for (const step of process.steps) {
      const dueDate = step.slaDays != null ? new Date(cycle.startDate.getTime() + step.slaDays * 24 * 60 * 60 * 1000) : null;
      await db.cycleStep.create({
        data: { cycleId: id, processStepId: step.id, name: step.name, order: step.order, ownerRoleKey: step.ownerRoleKey, ownerUserId: step.ownerUserId, dueDate, status: 'pending' },
      });
    }
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'cycle.steps_generated', entityType: 'evaluation_cycle', entityId: id, after: { count: process.steps.length } }, req);
    sendData(res, { created: process.steps.length }, 201);
  }),
);

cyclesRouter.patch(
  '/steps/:stepId',
  requirePermission('cycles.edit'),
  validateBody(cycleStepSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const stepId = Number(req.params.stepId);
    const step = await db.cycleStep.findFirst({ where: { id: stepId, cycle: { organizationId: orgId } } });
    if (!step) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.cycleStep.update({
      where: { id: stepId },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.order !== undefined ? { order: body.order as number } : {}),
        ...(body.ownerRoleKey !== undefined ? { ownerRoleKey: (body.ownerRoleKey as string) ?? null } : {}),
        ...(body.ownerUserId !== undefined ? { ownerUserId: (body.ownerUserId as number | null) ?? null } : {}),
        ...(body.dueDate !== undefined ? { dueDate: (body.dueDate as Date) ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

cyclesRouter.delete(
  '/steps/:stepId',
  requirePermission('cycles.edit'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const stepId = Number(req.params.stepId);
    const step = await db.cycleStep.findFirst({ where: { id: stepId, cycle: { organizationId: orgId } } });
    if (!step) throw notFound();
    await db.cycleStep.delete({ where: { id: stepId } });
    sendData(res, { ok: true });
  }),
);
