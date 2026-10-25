import { Router } from 'express';
import { config } from '../../config.js';
import { db } from '../../db.js';
import { asyncHandler, sendData, unauthorized } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';
import { runDueJobs, requeueStalledJobs, registeredJobTypes } from '../../lib/jobs.js';

export const jobsRouter = Router();

/**
 * Drain due jobs. Callable by a scheduler (cron) with the bearer secret, and by
 * an authorized administrator from the admin panel. Exempt from CSRF because it
 * is authenticated by a bearer secret, not a cookie.
 */
jobsRouter.post(
  '/run',
  asyncHandler(async (req, res) => {
    const secret = config.CRON_SECRET;
    const header = req.get('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;

    const viaCron = Boolean(secret && bearer && bearer === secret);
    const viaAdmin = Boolean(req.auth && req.auth.permissions.includes('jobs.manage'));
    if (!viaCron && !viaAdmin) throw unauthorized('دسترسی به این مسیر مجاز نیست.');

    const requeued = await requeueStalledJobs();
    const result = await runDueJobs(`api-${process.pid}`, 25);
    sendData(res, { ...result, requeued });
  }),
);

jobsRouter.get(
  '/',
  requirePermission('jobs.manage'),
  asyncHandler(async (_req, res) => {
    const items = await db.job.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    sendData(res, { items, types: registeredJobTypes() });
  }),
);

jobsRouter.get(
  '/config',
  requirePermission('jobs.manage'),
  asyncHandler(async (_req, res) => {
    sendData(res, { types: registeredJobTypes(), cronConfigured: Boolean(config.CRON_SECRET) });
  }),
);
