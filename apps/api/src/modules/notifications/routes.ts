import { Router } from 'express';
import { db } from '../../db.js';
import { asyncHandler, notFound, sendData } from '../../lib/http.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';

export const notificationsRouter = Router();

/** GET /notifications — the signed-in user's inbox (newest first). */
notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const perPage = Math.min(50, Math.max(1, Number(req.query.perPage ?? 10) || 10));
    const unreadOnly = req.query.unreadOnly === '1';
    const where = {
      userId: auth.id,
      organizationId: orgId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: perPage,
        select: { id: true, type: true, title: true, body: true, data: true, readAt: true, createdAt: true },
      }),
      db.notification.count({ where: { userId: auth.id, organizationId: orgId, readAt: null } }),
    ]);

    sendData(res, { items, unread });
  }),
);

/** POST /notifications/:id/read — idempotent single-item read. */
notificationsRouter.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const row = await db.notification.findFirst({ where: { id, userId: auth.id, organizationId: orgId } });
    if (!row) throw notFound('اعلان مورد نظر یافت نشد.');
    if (!row.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
    sendData(res, { ok: true });
  }),
);

/** POST /notifications/read-all — clears the unread badge. */
notificationsRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const result = await db.notification.updateMany({
      where: { userId: auth.id, organizationId: orgId, readAt: null },
      data: { readAt: new Date() },
    });
    sendData(res, { updated: result.count });
  }),
);
