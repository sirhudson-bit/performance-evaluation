import { Router } from 'express';
import { PERMISSION_DEFS, isKnownPermission } from '@pe/shared';
import { roleSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, conflict, forbidden, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const rolesRouter = Router();

rolesRouter.get(
  '/permissions',
  requirePermission('roles.view'),
  asyncHandler(async (_req, res) => {
    sendData(res, {
      categories: Array.from(new Set(PERMISSION_DEFS.map((p) => p.category))),
      permissions: PERMISSION_DEFS,
    });
  }),
);

rolesRouter.get(
  '/',
  requirePermission('roles.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const roles = await db.role.findMany({
      where: { organizationId: orgId },
      include: { permissions: { include: { permission: { select: { name: true } } } }, _count: { select: { users: true } } },
      orderBy: { id: 'asc' },
    });
    sendData(res, {
      items: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isProtected: r.isProtected,
        userCount: r._count.users,
        permissions: r.permissions.map((p) => p.permission.name),
      })),
    });
  }),
);

rolesRouter.post(
  '/',
  requirePermission('roles.manage'),
  validateBody(roleSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { name: string; key: string; description?: string; permissions: string[] };

    const unknown = body.permissions.filter((p) => !isKnownPermission(p));
    if (unknown.length > 0) throw forbidden('دسترسی ناشناخته در فهرست وجود دارد.');

    const exists = await db.role.findFirst({ where: { organizationId: orgId, key: body.key } });
    if (exists) throw conflict('نقشی با این شناسه وجود دارد.');

    const role = await db.role.create({ data: { organizationId: orgId, key: body.key, name: body.name, description: body.description ?? null } });
    await setRolePermissions(role.id, body.permissions);

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'role.created', entityType: 'role', entityId: role.id, after: body }, req);
    sendData(res, { id: role.id }, 201);
  }),
);

rolesRouter.patch(
  '/:id',
  requirePermission('roles.manage'),
  validateBody(roleSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const body = req.body as { name?: string; description?: string; permissions?: string[] };

    const role = await db.role.findFirst({ where: { id, organizationId: orgId } });
    if (!role) throw notFound();
    if (role.isProtected) throw forbidden('نقش محافظت‌شده قابل ویرایش نیست.');

    if (body.permissions) {
      const unknown = body.permissions.filter((p) => !isKnownPermission(p));
      if (unknown.length > 0) throw forbidden('دسترسی ناشناخته در فهرست وجود دارد.');
      await setRolePermissions(id, body.permissions);
    }

    await db.role.update({
      where: { id },
      data: { ...(body.name !== undefined ? { name: body.name } : {}), ...(body.description !== undefined ? { description: body.description } : {}) },
    });

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'role.updated', entityType: 'role', entityId: id, after: body }, req);
    sendData(res, { ok: true });
  }),
);

rolesRouter.delete(
  '/:id',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const role = await db.role.findFirst({ where: { id, organizationId: orgId }, include: { _count: { select: { users: true } } } });
    if (!role) throw notFound();
    if (role.isProtected) throw forbidden('نقش محافظت‌شده قابل حذف نیست.');
    if (role._count.users > 0) throw conflict('این نقش به کاربرانی اختصاص یافته و قابل حذف نیست.');

    await db.role.delete({ where: { id } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'role.deleted', entityType: 'role', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);

async function setRolePermissions(roleId: number, names: string[]): Promise<void> {
  const permissions = await db.permission.findMany({ where: { name: { in: names } } });
  await db.rolePermission.deleteMany({ where: { roleId } });
  if (permissions.length > 0) {
    await db.rolePermission.createMany({ data: permissions.map((p) => ({ roleId, permissionId: p.id })), skipDuplicates: true });
  }
}
