import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { userCreateSchema, userUpdateSchema, searchQuery } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound, sendData } from '../../lib/http.js';
import { randomToken, sha256 } from '../../lib/crypto.js';
import { config } from '../../config.js';
import { sendMail } from '../../lib/mailer.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody, validateQuery, query } from '../../middleware/validate.js';

export const usersRouter = Router();

function selectUser() {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
    status: true,
    mfaEnabled: true,
    themePreference: true,
    lastLoginAt: true,
    createdAt: true,
    roles: { select: { role: { select: { id: true, key: true, name: true } } } },
    department: { select: { id: true, name: true } },
    employee: { select: { id: true, employeeNo: true, firstName: true, lastName: true } },
  } as const;
}

usersRouter.get(
  '/',
  requirePermission('users.view'),
  validateQuery(searchQuery),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { page, perPage, q } = query<{ page: number; perPage: number; q?: string }>(req);

    const rows = await db.user.findMany({
      where: {
        organizationId: orgId,
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      select: selectUser(),
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    const total = await db.user.count({ where: { organizationId: orgId } });
    sendData(res, { items: rows, total, page, perPage });
  }),
);

usersRouter.post(
  '/',
  requirePermission('users.create'),
  validateBody(userCreateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { name: string; email: string; password?: string; roleIds: number[]; status: string; linkEmployeeId?: number | null; departmentId?: number | null };

    const existing = await db.user.findFirst({ where: { organizationId: orgId, email: body.email } });
    if (existing) throw conflict('کاربری با این ایمیل در سازمان ثبت شده است.', [{ path: 'email', message: 'این ایمیل تکراری است.' }]);

    const generated = !body.password;
    const password = body.password ?? randomToken(12);
    const user = await db.user.create({
      data: {
        organizationId: orgId,
        name: body.name,
        email: body.email,
        passwordHash: bcrypt.hashSync(password, 12),
        status: body.status,
        departmentId: body.departmentId ?? null,
      },
    });

    await assignRoles(orgId, user.id, body.roleIds);

    if (body.linkEmployeeId) {
      const employee = await db.employee.findFirst({ where: { id: body.linkEmployeeId, organizationId: orgId } });
      if (employee) await db.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'user.created', entityType: 'user', entityId: user.id, after: { email: user.email, status: user.status } }, req);
    sendData(res, { user: await db.user.findUniqueOrThrow({ where: { id: user.id }, select: selectUser() }), ...(generated ? { generatedPassword: password } : {}) }, 201);
  }),
);

usersRouter.get(
  '/:id',
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const user = await db.user.findFirst({ where: { id, organizationId: orgId }, select: selectUser() });
    if (!user) throw notFound();
    sendData(res, { user });
  }),
);

usersRouter.patch(
  '/:id',
  requirePermission('users.edit'),
  validateBody(userUpdateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const body = req.body as { name?: string; email?: string; roleIds?: number[]; status?: string; departmentId?: number | null; phone?: string | null };

    const target = await db.user.findFirst({ where: { id, organizationId: orgId } });
    if (!target) throw notFound();

    // Guard-rail: an administrator cannot suspend their own account.
    if (body.status && body.status !== 'active' && id === auth.id) {
      throw badRequest('امکان غیرفعال‌سازی حساب خودتان وجود ندارد.');
    }
    if (body.email && body.email !== target.email) {
      const dup = await db.user.findFirst({ where: { organizationId: orgId, email: body.email } });
      if (dup) throw conflict('این ایمیل قبلاً استفاده شده است.', [{ path: 'email', message: 'ایمیل تکراری است.' }]);
    }

    await db.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.departmentId !== undefined ? { departmentId: body.departmentId ?? null } : {}),
      },
    });

    if (body.roleIds) await assignRoles(orgId, id, body.roleIds);

    // Suspending/archiving a user destroys their sessions: the session row, not
    // the flag, is what grants access.
    if (body.status && body.status !== 'active') {
      await db.session.deleteMany({ where: { userId: id } });
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'user.updated', entityType: 'user', entityId: id, after: body }, req);
    sendData(res, { user: await db.user.findUniqueOrThrow({ where: { id }, select: selectUser() }) });
  }),
);

async function assignRoles(organizationId: number, userId: number, roleIds: number[]): Promise<void> {
  const roles = await db.role.findMany({ where: { id: { in: roleIds }, organizationId } });
  const protectedAttempt = roles.find((r) => r.isProtected);
  if (protectedAttempt) throw forbidden('این نقش قابل واگذاری نیست.');
  await db.userRole.deleteMany({ where: { userId } });
  if (roles.length > 0) {
    await db.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.id })), skipDuplicates: true });
  }
}

/** Issues a single-use reset link. The existing password is never revealed. */
usersRouter.post(
  '/:id/reset-password',
  requirePermission('users.edit'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const target = await db.user.findFirst({ where: { id, organizationId: orgId } });
    if (!target) throw notFound();

    const token = randomToken(32);
    await db.passwordResetToken.create({
      data: { userId: target.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${config.APP_URL}/reset-password?token=${token}`;
    const mail = await sendMail({ to: target.email, subject: 'بازنشانی رمز عبور', text: `پیوند بازنشانی رمز (تا یک ساعت معتبر است):\n${link}` });

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'user.password_reset_issued', entityType: 'user', entityId: id }, req);
    sendData(res, {
      ok: true,
      link,
      emailed: mail.sent,
      note: 'این پیوند یک‌بارمصرف و تا یک ساعت معتبر است. رمز فعلی هرگز نمایش داده نمی‌شود.',
    });
  }),
);

/** Deletes a user. Default is archive (keeps history); `?hard=1` deletes permanently. */
usersRouter.delete(
  '/:id',
  requirePermission('users.archive'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const hard = req.query.hard === '1';

    if (id === auth.id) throw badRequest('امکان حذف حساب خودتان وجود ندارد.');

    const target = await db.user.findFirst({ where: { id, organizationId: orgId }, include: { roles: { include: { role: true } } } });
    if (!target) throw notFound();

    const isPlatform = target.isPlatformAdmin || target.roles.some((r) => r.role.key === 'platform_super_admin');
    if (isPlatform) {
      if (!auth.permissions.includes('settings.manage')) throw forbidden('حذف مدیر ارشد تنها توسط مدیر سامانه مجاز است.');
      const platformCount = await db.user.count({
        where: { organizationId: orgId, OR: [{ isPlatformAdmin: true }, { roles: { some: { role: { key: 'platform_super_admin' } } } }] },
      });
      if (platformCount <= 1) throw conflict('آخرین مدیر ارشد سامانه قابل حذف نیست.');
    }

    // Revoke access immediately: the session row is what grants access.
    await db.session.deleteMany({ where: { userId: id } });

    if (hard) {
      await db.user.delete({ where: { id } });
    } else {
      await db.user.update({ where: { id }, data: { status: 'archived' } });
    }
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: hard ? 'user.deleted' : 'user.archived', entityType: 'user', entityId: id }, req);
    sendData(res, { ok: true, hard });
  }),
);
