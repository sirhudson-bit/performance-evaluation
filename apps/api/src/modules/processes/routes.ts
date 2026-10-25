import { Router } from 'express';
import { processSchema, processStepSchema, processDimensionSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, conflict, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const processesRouter = Router();

async function loadProcess(orgId: number, id: number) {
  const row = await db.performanceProcess.findFirst({ where: { id, organizationId: orgId } });
  if (!row) throw notFound();
  return row;
}

processesRouter.get(
  '/',
  requirePermission('processes.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.performanceProcess.findMany({
      where: { organizationId: orgId },
      include: { steps: { orderBy: { order: 'asc' } }, dimensions: { orderBy: { sortOrder: 'asc' } }, _count: { select: { cycles: true } } },
      orderBy: { id: 'desc' },
    });
    sendData(res, { items });
  }),
);

processesRouter.post(
  '/',
  requirePermission('processes.manage'),
  validateBody(processSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { name: string; description?: string; evaluationModel: string; targetGroups: unknown[]; status: string };

    const latest = await db.performanceProcess.findFirst({ where: { organizationId: orgId, name: body.name }, orderBy: { version: 'desc' } });
    if (latest) throw conflict('فرایندی با این نام از قبل وجود دارد؛ برای تغییر، نسخه جدید بسازید.');

    const row = await db.performanceProcess.create({
      data: {
        organizationId: orgId,
        name: body.name,
        description: body.description ?? null,
        evaluationModel: body.evaluationModel,
        targetGroups: body.targetGroups as object[],
        status: body.status,
        createdBy: auth.id,
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'process.created', entityType: 'performance_process', entityId: row.id }, req);
    sendData(res, { id: row.id }, 201);
  }),
);

processesRouter.get(
  '/:id',
  requirePermission('processes.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    await loadProcess(orgId, Number(req.params.id));
    const process = await db.performanceProcess.findUniqueOrThrow({
      where: { id: Number(req.params.id) },
      include: { steps: { orderBy: { order: 'asc' } }, dimensions: { orderBy: { sortOrder: 'asc' } } },
    });
    sendData(res, { process });
  }),
);

processesRouter.patch(
  '/:id',
  requirePermission('processes.manage'),
  validateBody(processSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    await loadProcess(orgId, id);
    const body = req.body as Record<string, unknown>;
    await db.performanceProcess.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.description !== undefined ? { description: (body.description as string) ?? null } : {}),
        ...(body.evaluationModel !== undefined ? { evaluationModel: body.evaluationModel as string } : {}),
        ...(body.targetGroups !== undefined ? { targetGroups: body.targetGroups as object[] } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'process.updated', entityType: 'performance_process', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);

// --- steps -----------------------------------------------------------------
processesRouter.post(
  '/:id/steps',
  requirePermission('processes.manage'),
  validateBody(processStepSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const processId = Number(req.params.id);
    await loadProcess(orgId, processId);
    const body = req.body as Record<string, unknown>;
    const row = await db.processStep.create({
      data: {
        processId,
        name: body.name as string,
        description: (body.description as string) ?? null,
        order: body.order as number,
        ownerType: body.ownerType as string,
        ownerRoleKey: (body.ownerRoleKey as string) ?? null,
        ownerUserId: (body.ownerUserId as number | null) ?? null,
        ownerUnitId: (body.ownerUnitId as number | null) ?? null,
        slaDays: (body.slaDays as number | null) ?? null,
      },
    });
    sendData(res, { id: row.id }, 201);
  }),
);

processesRouter.patch(
  '/steps/:stepId',
  requirePermission('processes.manage'),
  validateBody(processStepSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const stepId = Number(req.params.stepId);
    const step = await db.processStep.findFirst({ where: { id: stepId, process: { organizationId: orgId } } });
    if (!step) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.processStep.update({
      where: { id: stepId },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.description !== undefined ? { description: (body.description as string) ?? null } : {}),
        ...(body.order !== undefined ? { order: body.order as number } : {}),
        ...(body.ownerType !== undefined ? { ownerType: body.ownerType as string } : {}),
        ...(body.ownerRoleKey !== undefined ? { ownerRoleKey: (body.ownerRoleKey as string) ?? null } : {}),
        ...(body.ownerUserId !== undefined ? { ownerUserId: (body.ownerUserId as number | null) ?? null } : {}),
        ...(body.ownerUnitId !== undefined ? { ownerUnitId: (body.ownerUnitId as number | null) ?? null } : {}),
        ...(body.slaDays !== undefined ? { slaDays: (body.slaDays as number | null) ?? null } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

processesRouter.delete(
  '/steps/:stepId',
  requirePermission('processes.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const stepId = Number(req.params.stepId);
    const step = await db.processStep.findFirst({ where: { id: stepId, process: { organizationId: orgId } } });
    if (!step) throw notFound();
    await db.processStep.delete({ where: { id: stepId } });
    sendData(res, { ok: true });
  }),
);

// --- dimensions ------------------------------------------------------------
processesRouter.post(
  '/:id/dimensions',
  requirePermission('processes.manage'),
  validateBody(processDimensionSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const processId = Number(req.params.id);
    await loadProcess(orgId, processId);
    const body = req.body as Record<string, unknown>;
    const row = await db.processDimension.create({
      data: {
        processId,
        name: body.name as string,
        description: (body.description as string) ?? null,
        weight: body.weight as number,
        ownerRoleKey: (body.ownerRoleKey as string) ?? null,
        ownerUserId: (body.ownerUserId as number | null) ?? null,
        sortOrder: body.sortOrder as number,
      },
    });
    sendData(res, { id: row.id }, 201);
  }),
);

processesRouter.patch(
  '/dimensions/:dimensionId',
  requirePermission('processes.manage'),
  validateBody(processDimensionSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const dimensionId = Number(req.params.dimensionId);
    const dimension = await db.processDimension.findFirst({ where: { id: dimensionId, process: { organizationId: orgId } } });
    if (!dimension) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.processDimension.update({
      where: { id: dimensionId },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.description !== undefined ? { description: (body.description as string) ?? null } : {}),
        ...(body.weight !== undefined ? { weight: body.weight as number } : {}),
        ...(body.ownerRoleKey !== undefined ? { ownerRoleKey: (body.ownerRoleKey as string) ?? null } : {}),
        ...(body.ownerUserId !== undefined ? { ownerUserId: (body.ownerUserId as number | null) ?? null } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder as number } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

processesRouter.delete(
  '/dimensions/:dimensionId',
  requirePermission('processes.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const dimensionId = Number(req.params.dimensionId);
    const dimension = await db.processDimension.findFirst({ where: { id: dimensionId, process: { organizationId: orgId } } });
    if (!dimension) throw notFound();
    await db.processDimension.delete({ where: { id: dimensionId } });
    sendData(res, { ok: true });
  }),
);

processesRouter.post(
  '/:id/archive',
  requirePermission('processes.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    await loadProcess(orgId, id);
    await db.performanceProcess.update({ where: { id }, data: { status: 'archived' } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'process.archived', entityType: 'performance_process', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);
