import { Router } from 'express';
import { employeeSchema, managerHistorySchema, searchQuery } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, conflict, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization, resolveEmployeeScope, assertEmployeeAccess } from '../../middleware/scope.js';
import { validateBody, validateQuery, query } from '../../middleware/validate.js';

export const employeesRouter = Router();

const employeeSelect = {
  id: true,
  employeeNo: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  hireDate: true,
  unit: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
  user: { select: { id: true, email: true } },
} as const;

employeesRouter.get(
  '/',
  requirePermission('employees.view'),
  validateQuery(searchQuery),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const scope = await resolveEmployeeScope(auth);
    const { page, perPage, q } = query<{ page: number; perPage: number; q?: string }>(req);

    const where = {
      organizationId: orgId,
      ...(scope.seesAll ? {} : { id: { in: scope.employeeIds } }),
      ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { employeeNo: { contains: q } }] } : {}),
    };

    const [items, total] = await Promise.all([
      db.employee.findMany({ where, select: employeeSelect, orderBy: { id: 'asc' }, skip: (page - 1) * perPage, take: perPage }),
      db.employee.count({ where }),
    ]);

    sendData(res, { items, total, page, perPage, scope: { seesAll: scope.seesAll } });
  }),
);

employeesRouter.post(
  '/',
  requirePermission('employees.create'),
  validateBody(employeeSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;

    const dup = await db.employee.findFirst({ where: { organizationId: orgId, employeeNo: body.employeeNo as string } });
    if (dup) throw conflict('کارمندی با این شماره پرسنلی وجود دارد.', [{ path: 'employeeNo', message: 'شماره پرسنلی تکراری است.' }]);

    const employee = await db.employee.create({
      data: {
        organizationId: orgId,
        employeeNo: body.employeeNo as string,
        firstName: body.firstName as string,
        lastName: body.lastName as string,
        displayName: (body.displayName as string) ?? null,
        email: (body.email as string) ?? null,
        phone: (body.phone as string) ?? null,
        unitId: (body.unitId as number | null) ?? null,
        positionId: (body.positionId as number | null) ?? null,
        managerId: (body.managerId as number | null) ?? null,
        hireDate: (body.hireDate as Date) ?? null,
        status: (body.status as string) ?? 'active',
      },
    });

    if (body.managerId) {
      await db.employeeManagerHistory.create({
        data: { organizationId: orgId, employeeId: employee.id, managerEmployeeId: body.managerId as number, unitId: (body.unitId as number) ?? null, positionId: (body.positionId as number) ?? null, effectiveFrom: new Date() },
      });
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'employee.created', entityType: 'employee', entityId: employee.id, after: { employeeNo: employee.employeeNo } }, req);
    sendData(res, { id: employee.id }, 201);
  }),
);

employeesRouter.get(
  '/:id',
  requirePermission('employees.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const id = Number(req.params.id);
    await assertEmployeeAccess(auth, id);
    const employee = await db.employee.findUniqueOrThrow({ where: { id }, select: employeeSelect });
    sendData(res, { employee });
  }),
);

employeesRouter.patch(
  '/:id',
  requirePermission('employees.edit'),
  validateBody(employeeSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const employee = await db.employee.findFirst({ where: { id, organizationId: orgId } });
    if (!employee) throw notFound();

    const body = req.body as Record<string, unknown>;
    await db.employee.update({
      where: { id },
      data: {
        ...(body.firstName !== undefined ? { firstName: body.firstName as string } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName as string } : {}),
        ...(body.displayName !== undefined ? { displayName: (body.displayName as string) ?? null } : {}),
        ...(body.email !== undefined ? { email: (body.email as string) ?? null } : {}),
        ...(body.phone !== undefined ? { phone: (body.phone as string) ?? null } : {}),
        ...(body.unitId !== undefined ? { unitId: (body.unitId as number | null) ?? null } : {}),
        ...(body.positionId !== undefined ? { positionId: (body.positionId as number | null) ?? null } : {}),
        ...(body.managerId !== undefined ? { managerId: (body.managerId as number | null) ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status as string } : {}),
      },
    });

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'employee.updated', entityType: 'employee', entityId: id, after: body }, req);
    sendData(res, { ok: true });
  }),
);

employeesRouter.get(
  '/:id/history',
  requirePermission('employees.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const id = Number(req.params.id);
    await assertEmployeeAccess(auth, id);
    const history = await db.employeeManagerHistory.findMany({
      where: { employeeId: id },
      include: { manager: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
    sendData(res, { items: history });
  }),
);

employeesRouter.post(
  '/:id/manager-history',
  requirePermission('employees.manage_info'),
  validateBody(managerHistorySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const employee = await db.employee.findFirst({ where: { id, organizationId: orgId } });
    if (!employee) throw notFound();

    const body = req.body as { managerEmployeeId: number | null; unitId?: number | null; positionId?: number | null; effectiveFrom: Date; effectiveTo?: Date; reason?: string };

    // Close the previous open record for this employee before opening a new one.
    await db.employeeManagerHistory.updateMany({
      where: { employeeId: id, effectiveTo: null },
      data: { effectiveTo: body.effectiveFrom },
    });

    const record = await db.employeeManagerHistory.create({
      data: {
        organizationId: orgId,
        employeeId: id,
        managerEmployeeId: body.managerEmployeeId,
        unitId: body.unitId ?? null,
        positionId: body.positionId ?? null,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo ?? null,
        reason: body.reason ?? null,
      },
    });

    await db.employee.update({ where: { id }, data: { managerId: body.managerEmployeeId, unitId: body.unitId ?? employee.unitId, positionId: body.positionId ?? employee.positionId } });

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'employee.manager_changed', entityType: 'employee', entityId: id, after: body }, req);
    sendData(res, { id: record.id }, 201);
  }),
);
