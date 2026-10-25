import { Router } from 'express';
import { settingsSchema, complianceSchema, thirdPartyServiceSchema, assetSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const adminRouter = Router();

// --- Settings --------------------------------------------------------------
adminRouter.get(
  '/settings',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const rows = await db.setting.findMany({ where: { organizationId: orgId } });
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    sendData(res, { settings });
  }),
);

adminRouter.put(
  '/settings',
  requirePermission('settings.manage'),
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, string>;

    // Upsert each provided key; unrelated keys are preserved (never reset).
    for (const [key, value] of Object.entries(body)) {
      await db.setting.upsert({
        where: { organizationId_key: { organizationId: orgId, key } },
        update: { value },
        create: { organizationId: orgId, key, value },
      });
    }
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'settings.updated', entityType: 'setting', entityId: null, after: { keys: Object.keys(body) } }, req);
    sendData(res, { ok: true });
  }),
);

// --- Compliance / business identity ----------------------------------------
adminRouter.get(
  '/compliance',
  requirePermission('compliance.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const profile = await db.complianceProfile.findUnique({ where: { organizationId: orgId } });
    sendData(res, {
      profile,
      // Fields still requiring business confirmation (never fabricated).
      missing: profile
        ? Object.entries({
            legalName: profile.legalName,
            country: profile.country,
            contactEmail: profile.contactEmail,
            contactPhone: profile.contactPhone,
          })
            .filter(([, v]) => !v)
            .map(([k]) => k)
        : ['legalName', 'country', 'contactEmail', 'contactPhone'],
    });
  }),
);

adminRouter.put(
  '/compliance',
  requirePermission('compliance.manage'),
  validateBody(complianceSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;

    const data = {
      legalName: (body.legalName as string) ?? null,
      registrationNo: (body.registrationNo as string) ?? null,
      nationalId: (body.nationalId as string) ?? null,
      address: (body.address as string) ?? null,
      country: (body.country as string) ?? null,
      contactEmail: (body.contactEmail as string) ?? null,
      contactPhone: (body.contactPhone as string) ?? null,
      jurisdictions: (body.jurisdictions as string[]) ?? [],
      targetMarkets: (body.targetMarkets as string[]) ?? [],
      serviceOfferings: (body.serviceOfferings as string) ?? null,
      hasPaidOffering: (body.hasPaidOffering as boolean) ?? false,
      dataRetention: (body.dataRetention as string) ?? null,
      internationalTransfers: (body.internationalTransfers as string) ?? null,
      policyVersion: (body.policyVersion as string) ?? '1.0',
      reviewedBy: (body.reviewedBy as string) ?? null,
    };

    await db.complianceProfile.upsert({
      where: { organizationId: orgId },
      update: data,
      create: { organizationId: orgId, ...data },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'compliance.updated', entityType: 'compliance_profile', entityId: orgId, after: data }, req);
    sendData(res, { ok: true });
  }),
);

// --- Third-party / tracking register ---------------------------------------
adminRouter.get(
  '/third-party',
  requirePermission('compliance.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.thirdPartyService.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } });
    sendData(res, { items });
  }),
);

adminRouter.post(
  '/third-party',
  requirePermission('compliance.manage'),
  validateBody(thirdPartyServiceSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;
    const row = await db.thirdPartyService.create({
      data: {
        organizationId: orgId,
        name: body.name as string,
        provider: (body.provider as string) ?? null,
        purpose: body.purpose as string,
        category: body.category as string,
        dataTransmitted: (body.dataTransmitted as string) ?? null,
        requiresConsent: body.requiresConsent as boolean,
        isActive: body.isActive as boolean,
        privacyUrl: (body.privacyUrl as string) ?? null,
        notes: (body.notes as string) ?? null,
      },
    });
    sendData(res, { id: row.id }, 201);
  }),
);

adminRouter.patch(
  '/third-party/:id',
  requirePermission('compliance.manage'),
  validateBody(thirdPartyServiceSchema.partial()),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const row = await db.thirdPartyService.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw notFound();
    const body = req.body as Record<string, unknown>;
    await db.thirdPartyService.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.provider !== undefined ? { provider: (body.provider as string) ?? null } : {}),
        ...(body.purpose !== undefined ? { purpose: body.purpose as string } : {}),
        ...(body.category !== undefined ? { category: body.category as string } : {}),
        ...(body.dataTransmitted !== undefined ? { dataTransmitted: (body.dataTransmitted as string) ?? null } : {}),
        ...(body.requiresConsent !== undefined ? { requiresConsent: body.requiresConsent as boolean } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive as boolean } : {}),
        ...(body.privacyUrl !== undefined ? { privacyUrl: (body.privacyUrl as string) ?? null } : {}),
        ...(body.notes !== undefined ? { notes: (body.notes as string) ?? null } : {}),
      },
    });
    sendData(res, { ok: true });
  }),
);

adminRouter.delete(
  '/third-party/:id',
  requirePermission('compliance.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    await db.thirdPartyService.deleteMany({ where: { id: Number(req.params.id), organizationId: orgId } });
    sendData(res, { ok: true });
  }),
);

// --- Asset / license register ----------------------------------------------
adminRouter.get(
  '/assets',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.asset.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } });
    sendData(res, { items });
  }),
);

adminRouter.post(
  '/assets',
  requirePermission('settings.manage'),
  validateBody(assetSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;
    const row = await db.asset.create({
      data: {
        organizationId: orgId,
        name: body.name as string,
        kind: body.kind as string,
        source: (body.source as string) ?? null,
        license: (body.license as string) ?? null,
        attribution: (body.attribution as string) ?? null,
        commercialUse: body.commercialUse as boolean,
        usage: (body.usage as string) ?? null,
        verified: body.verified as boolean,
      },
    });
    sendData(res, { id: row.id }, 201);
  }),
);

// --- Audit -----------------------------------------------------------------
adminRouter.get(
  '/audit',
  requirePermission('audit.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const page = Number(req.query.page ?? 1);
    const perPage = Math.min(Number(req.query.perPage ?? 50), 200);
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;

    const where = { organizationId: orgId, ...(entityType ? { entityType } : {}), ...(action ? { action: { contains: action } } : {}) };
    const [items, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
      db.auditLog.count({ where }),
    ]);
    sendData(res, { items, total, page, perPage });
  }),
);

// --- Admin overview & security ---------------------------------------------
adminRouter.get(
  '/overview',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);

    const [users, employees, activeCycles, pendingReviews, jobsByStatus, exportJobs, importJobs, failedLogins] = await Promise.all([
      db.user.count({ where: { organizationId: orgId } }),
      db.employee.count({ where: { organizationId: orgId, status: 'active' } }),
      db.evaluationCycle.count({ where: { organizationId: orgId, status: { in: ['active', 'in_review'] } } }),
      db.evaluationAssignment.count({ where: { organizationId: orgId, status: 'submitted' } }),
      db.job.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: { _all: true } }),
      db.exportJob.count({ where: { organizationId: orgId } }),
      db.importJob.count({ where: { organizationId: orgId } }),
      db.auditLog.count({ where: { organizationId: orgId, action: 'auth.login_failed' } }),
    ]);

    sendData(res, {
      users,
      employees,
      activeCycles,
      pendingReviews,
      jobs: Object.fromEntries(jobsByStatus.map((j) => [j.status, j._count._all])),
      exportJobs,
      importJobs,
      failedLogins,
    });
  }),
);

adminRouter.get(
  '/security/overview',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const sessions = await db.session.findMany({
      where: { user: { organizationId: auth.organizationId } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { lastActivity: 'desc' },
      take: 50,
    });
    const recent = await db.auditLog.findMany({ where: { organizationId: auth.organizationId }, orderBy: { createdAt: 'desc' }, take: 30 });
    sendData(res, {
      sessions: sessions.map((s) => ({ id: s.id, user: s.user, lastActivity: s.lastActivity, ipAddress: s.ipAddress, userAgent: s.userAgent })),
      recent,
      currentSessionId: auth.sessionId,
    });
  }),
);

adminRouter.delete(
  '/security/sessions/:id',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = req.params.id;
    const session = await db.session.findFirst({ where: { id, user: { organizationId: orgId } } });
    if (!session) throw notFound();
    await db.session.delete({ where: { id } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'session.revoked', entityType: 'session', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);

/**
 * Prune old audit records to bound database growth. Defaults to removing logs
 * older than 30 days; `all=1` clears everything for the organization. The clear
 * action itself is recorded afterwards, so it is never removed silently.
 */
adminRouter.delete(
  '/audit/clear',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const all = req.query.all === '1';
    const days = req.query.days ? Math.max(0, Number(req.query.days)) : 30;

    const where = all
      ? { organizationId: orgId }
      : { organizationId: orgId, createdAt: { lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } };

    const result = await db.auditLog.deleteMany({ where });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'audit.cleared', entityType: 'audit_log', after: { deleted: result.count, all, days } }, req);
    sendData(res, { deleted: result.count, all, days });
  }),
);
