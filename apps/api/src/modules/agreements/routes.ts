import { Router } from 'express';
import { agreementSchema, agreementEntrySchema, agreementIndicatorUpdateSchema } from '@pe/validation';
import { Prisma } from '@prisma/client';
import { db } from '../../db.js';
import { asyncHandler, conflict, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization, resolveEmployeeScope } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const agreementsRouter = Router();

/** A user sees agreements for employees in their scope; managers can manage them. */
async function assertAgreementVisible(orgId: number, auth: ReturnType<typeof getAuth>, agreementId: number) {
  const row = await db.performanceAgreement.findFirst({ where: { id: agreementId, organizationId: orgId } });
  if (!row) throw notFound();
  const scope = await resolveEmployeeScope(auth);
  if (!scope.seesAll && !scope.employeeIds.includes(row.employeeId)) throw notFound();
  return row;
}

agreementsRouter.get(
  '/',
  requirePermission('agreements.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const scope = await resolveEmployeeScope(auth);
    const items = await db.performanceAgreement.findMany({
      where: { organizationId: orgId, ...(scope.seesAll ? {} : { employeeId: { in: scope.employeeIds } }) },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
        indicators: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { entries: true } },
      },
      orderBy: { id: 'desc' },
    });
    sendData(res, { items });
  }),
);

agreementsRouter.post(
  '/',
  requirePermission('agreements.manage'),
  validateBody(agreementSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as {
      employeeId: number;
      cycleId?: number | null;
      title: string;
      description?: string;
      status: string;
      startDate?: Date;
      endDate?: Date;
      indicators: { name: string; description?: string; unit?: string; targetValue?: number | null; actualValue?: number | null; weight: number; progress: number; sortOrder: number }[];
    };

    const employee = await db.employee.findFirst({ where: { id: body.employeeId, organizationId: orgId } });
    if (!employee) throw notFound('کارمند یافت نشد.');

    const agreement = await db.performanceAgreement.create({
      data: {
        organizationId: orgId,
        employeeId: body.employeeId,
        cycleId: body.cycleId ?? null,
        title: body.title,
        description: body.description ?? null,
        status: body.status,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        createdBy: auth.id,
        indicators: {
          create: body.indicators.map((i) => ({
            name: i.name,
            description: i.description ?? null,
            unit: i.unit ?? null,
            targetValue: i.targetValue != null ? new Prisma.Decimal(i.targetValue) : null,
            actualValue: i.actualValue != null ? new Prisma.Decimal(i.actualValue) : null,
            weight: new Prisma.Decimal(i.weight),
            progress: i.progress,
            sortOrder: i.sortOrder,
          })),
        },
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'agreement.created', entityType: 'performance_agreement', entityId: agreement.id }, req);
    sendData(res, { id: agreement.id }, 201);
  }),
);

agreementsRouter.get(
  '/:id',
  requirePermission('agreements.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    await assertAgreementVisible(orgId, auth, id);
    const agreement = await db.performanceAgreement.findUniqueOrThrow({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
        indicators: { orderBy: { sortOrder: 'asc' } },
        entries: { orderBy: { createdAt: 'desc' } },
      },
    });
    sendData(res, { agreement });
  }),
);

agreementsRouter.patch(
  '/:id',
  requirePermission('agreements.manage'),
  validateBody(agreementSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    await assertAgreementVisible(orgId, auth, id);
    const body = req.body as Record<string, unknown>;
    await db.performanceAgreement.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title as string } : {}),
        ...(body.description !== undefined ? { description: (body.description as string) ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
        ...(body.startDate !== undefined ? { startDate: (body.startDate as Date) ?? null } : {}),
        ...(body.endDate !== undefined ? { endDate: (body.endDate as Date) ?? null } : {}),
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'agreement.updated', entityType: 'performance_agreement', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);

/** Records progress on one indicator. */
agreementsRouter.patch(
  '/indicators/:indicatorId',
  requirePermission('agreements.manage'),
  validateBody(agreementIndicatorUpdateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const indicatorId = Number(req.params.indicatorId);
    const indicator = await db.agreementIndicator.findFirst({ where: { id: indicatorId, agreement: { organizationId: orgId } } });
    if (!indicator) throw notFound();
    await assertAgreementVisible(orgId, auth, indicator.agreementId);
    const body = req.body as { actualValue?: number | null; progress?: number };

    await db.agreementIndicator.update({
      where: { id: indicatorId },
      data: {
        ...(body.actualValue !== undefined ? { actualValue: body.actualValue != null ? new Prisma.Decimal(body.actualValue) : null } : {}),
        ...(body.progress !== undefined ? { progress: body.progress } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

/** Appends an event / feedback / progress note to the agreement log. */
agreementsRouter.post(
  '/:id/entries',
  requirePermission('agreements.manage'),
  validateBody(agreementEntrySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    await assertAgreementVisible(orgId, auth, id);
    const body = req.body as { type: string; body: string };
    const entry = await db.agreementEntry.create({ data: { agreementId: id, authorUserId: auth.id, type: body.type, body: body.body } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'agreement.entry_added', entityType: 'performance_agreement', entityId: id }, req);
    sendData(res, { id: entry.id }, 201);
  }),
);

agreementsRouter.delete(
  '/:id',
  requirePermission('agreements.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const row = await assertAgreementVisible(orgId, auth, id);
    if (row.status === 'completed') throw conflict('توافق‌نامه تکمیل‌شده حذف نمی‌شود.');
    await db.performanceAgreement.delete({ where: { id } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'agreement.deleted', entityType: 'performance_agreement', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);
