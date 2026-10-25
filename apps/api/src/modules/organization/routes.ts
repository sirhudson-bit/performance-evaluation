import { Router } from 'express';
import { unitSchema, positionSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, conflict, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const organizationRouter = Router();

// --- Units -----------------------------------------------------------------
organizationRouter.get(
  '/units',
  requirePermission('organization.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const units = await db.organizationUnit.findMany({
      where: { organizationId: orgId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { employees: true } } },
    });
    sendData(res, { items: units });
  }),
);

organizationRouter.post(
  '/units',
  requirePermission('organization.manage'),
  validateBody(unitSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;
    const unit = await db.organizationUnit.create({
      data: {
        organizationId: orgId,
        name: body.name as string,
        code: (body.code as string) ?? null,
        parentId: (body.parentId as number | null) ?? null,
        type: body.type as string,
        sortOrder: body.sortOrder as number,
        status: body.status as string,
        effectiveFrom: (body.effectiveFrom as Date) ?? null,
        effectiveTo: (body.effectiveTo as Date) ?? null,
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'unit.created', entityType: 'organization_unit', entityId: unit.id, after: body }, req);
    sendData(res, { id: unit.id }, 201);
  }),
);

organizationRouter.patch(
  '/units/:id',
  requirePermission('organization.manage'),
  validateBody(unitSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const unit = await db.organizationUnit.findFirst({ where: { id, organizationId: orgId } });
    if (!unit) throw notFound();

    const body = req.body as Record<string, unknown>;
    if (body.parentId === id) throw conflict('یک واحد نمی‌تواند والد خودش باشد.');

    await db.organizationUnit.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.code !== undefined ? { code: (body.code as string) ?? null } : {}),
        ...(body.parentId !== undefined ? { parentId: (body.parentId as number | null) ?? null } : {}),
        ...(body.type !== undefined ? { type: body.type as string } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder as number } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'unit.updated', entityType: 'organization_unit', entityId: id, after: body }, req);
    sendData(res, { ok: true });
  }),
);

organizationRouter.delete(
  '/units/:id',
  requirePermission('organization.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const unit = await db.organizationUnit.findFirst({ where: { id, organizationId: orgId }, include: { _count: { select: { employees: true, children: true } } } });
    if (!unit) throw notFound();
    if (unit._count.employees > 0 || unit._count.children > 0) {
      // Archive instead of delete, to preserve history.
      await db.organizationUnit.update({ where: { id }, data: { status: 'archived' } });
      await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'unit.archived', entityType: 'organization_unit', entityId: id }, req);
      sendData(res, { ok: true, archived: true });
      return;
    }
    await db.organizationUnit.delete({ where: { id } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'unit.deleted', entityType: 'organization_unit', entityId: id }, req);
    sendData(res, { ok: true, archived: false });
  }),
);

// --- Positions -------------------------------------------------------------
organizationRouter.get(
  '/positions',
  requirePermission('organization.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const positions = await db.position.findMany({ where: { organizationId: orgId }, orderBy: { id: 'asc' } });
    sendData(res, { items: positions });
  }),
);

organizationRouter.post(
  '/positions',
  requirePermission('organization.manage'),
  validateBody(positionSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;
    const position = await db.position.create({
      data: {
        organizationId: orgId,
        title: body.title as string,
        code: (body.code as string) ?? null,
        unitId: (body.unitId as number | null) ?? null,
        level: (body.level as string) ?? null,
        status: body.status as string,
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'position.created', entityType: 'position', entityId: position.id, after: body }, req);
    sendData(res, { id: position.id }, 201);
  }),
);

organizationRouter.patch(
  '/positions/:id',
  requirePermission('organization.manage'),
  validateBody(positionSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const position = await db.position.findFirst({ where: { id, organizationId: orgId } });
    if (!position) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.position.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title as string } : {}),
        ...(body.code !== undefined ? { code: (body.code as string) ?? null } : {}),
        ...(body.unitId !== undefined ? { unitId: (body.unitId as number | null) ?? null } : {}),
        ...(body.level !== undefined ? { level: (body.level as string) ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'position.updated', entityType: 'position', entityId: id, after: body }, req);
    sendData(res, { ok: true });
  }),
);

organizationRouter.delete(
  '/positions/:id',
  requirePermission('organization.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const position = await db.position.findFirst({ where: { id, organizationId: orgId }, include: { _count: { select: { employees: true } } } });
    if (!position) throw notFound();

    // A position held by employees is archived (history preserved), not deleted.
    if (position._count.employees > 0) {
      await db.position.update({ where: { id }, data: { status: 'archived' } });
      await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'position.archived', entityType: 'position', entityId: id }, req);
      sendData(res, { ok: true, archived: true });
      return;
    }
    await db.position.delete({ where: { id } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'position.deleted', entityType: 'position', entityId: id }, req);
    sendData(res, { ok: true, archived: false });
  }),
);
