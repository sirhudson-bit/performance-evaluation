import { Router } from 'express';
import { compensationPolicySchema, recommendationSchema, recommendationUpdateSchema, generateRecommendationsSchema, compensationDecisionSchema } from '@pe/validation';
import { Prisma } from '@prisma/client';
import { db } from '../../db.js';
import { asyncHandler, badRequest, conflict, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const compensationRouter = Router();

interface PolicyRule {
  minScore: number;
  maxScore: number;
  type: 'percent' | 'amount' | 'promotion';
  value: number;
  min?: number;
  max?: number;
}

/**
 * Computes a *recommendation* from a policy. This never executes payroll, a
 * salary change, or a payment — it only proposes a value for an authorized human
 * to approve. The description states this explicitly to the caller.
 */
export function computeRecommendation(score: number | null, rules: PolicyRule[]): { type: string; value: number } | null {
  if (score === null) return null;
  const rule = rules.find((r) => score >= r.minScore && score <= r.maxScore);
  if (!rule) return null;
  let value = rule.value;
  if (rule.min !== undefined) value = Math.max(rule.min, value);
  if (rule.max !== undefined) value = Math.min(rule.max, value);
  return { type: rule.type, value };
}

// --- Policies --------------------------------------------------------------
compensationRouter.get(
  '/policies',
  requirePermission('compensation.policies_view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.compensationPolicy.findMany({ where: { organizationId: orgId }, orderBy: [{ name: 'asc' }, { version: 'desc' }] });
    sendData(res, { items });
  }),
);

compensationRouter.post(
  '/policies',
  requirePermission('compensation.policies_manage'),
  validateBody(compensationPolicySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { name: string; mode: string; effectiveFrom: Date; effectiveTo?: Date; config: object; status: string };

    const latest = await db.compensationPolicy.findFirst({ where: { organizationId: orgId, name: body.name }, orderBy: { version: 'desc' } });
    const policy = await db.compensationPolicy.create({
      data: {
        organizationId: orgId,
        name: body.name,
        version: (latest?.version ?? 0) + 1,
        mode: body.mode,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo ?? null,
        config: body.config as Prisma.InputJsonValue,
        status: body.status,
        createdBy: auth.id,
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'compensation_policy.created', entityType: 'compensation_policy', entityId: policy.id, after: { name: body.name, version: policy.version } }, req);
    sendData(res, { id: policy.id, version: policy.version }, 201);
  }),
);

// --- Recommendations -------------------------------------------------------
compensationRouter.get(
  '/recommendations',
  requirePermission('compensation.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.compensationRecommendation.findMany({
      where: { organizationId: orgId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } }, policy: { select: { id: true, name: true, version: true } }, approvals: true },
      orderBy: { createdAt: 'desc' },
    });
    sendData(res, { items });
  }),
);

compensationRouter.post(
  '/recommendations',
  requirePermission('compensation.recommend'),
  validateBody(recommendationSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { employeeId: number; cycleId?: number | null; mode: string; proposedType?: string | null; proposedValue?: number | null; rationale?: string };

    const employee = await db.employee.findFirst({ where: { id: body.employeeId, organizationId: orgId } });
    if (!employee) throw badRequest('کارمند یافت نشد.');

    const rec = await db.compensationRecommendation.create({
      data: {
        organizationId: orgId,
        employeeId: body.employeeId,
        cycleId: body.cycleId ?? null,
        mode: body.mode,
        proposedType: body.proposedType ?? null,
        proposedValue: body.proposedValue != null ? new Prisma.Decimal(body.proposedValue) : null,
        rationale: body.rationale ?? null,
        status: 'proposed',
        createdBy: auth.id,
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'compensation_recommendation.created', entityType: 'compensation_recommendation', entityId: rec.id }, req);
    sendData(res, { id: rec.id }, 201);
  }),
);

/** A proposer (typically the direct manager) edits a proposal before a decision. */
compensationRouter.patch(
  '/recommendations/:id',
  requirePermission('compensation.recommend'),
  validateBody(recommendationUpdateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const rec = await db.compensationRecommendation.findFirst({ where: { id, organizationId: orgId } });
    if (!rec) throw notFound();
    if (['approved', 'rejected', 'cancelled'].includes(rec.status)) throw conflict('پس از تصمیم‌گیری، ویرایش ممکن نیست.');

    const body = req.body as { proposedType?: string | null; proposedValue?: number | null; rationale?: string; cycleId?: number | null };
    await db.compensationRecommendation.update({
      where: { id },
      data: {
        ...(body.proposedType !== undefined ? { proposedType: body.proposedType } : {}),
        ...(body.proposedValue !== undefined ? { proposedValue: body.proposedValue != null ? new Prisma.Decimal(body.proposedValue) : null } : {}),
        ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
        ...(body.cycleId !== undefined ? { cycleId: body.cycleId ?? null } : {}),
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'compensation_recommendation.updated', entityType: 'compensation_recommendation', entityId: id, after: body }, req);
    sendData(res, { ok: true });
  }),
);

compensationRouter.post(
  '/recommendations/generate',
  requirePermission('compensation.recommend'),
  validateBody(generateRecommendationsSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { cycleId, compensationPolicyId } = req.body as { cycleId: number; compensationPolicyId: number };

    const policy = await db.compensationPolicy.findFirst({ where: { id: compensationPolicyId, organizationId: orgId } });
    if (!policy) throw notFound();
    const rules = ((policy.config as { rules?: PolicyRule[] }).rules ?? []) as PolicyRule[];

    const results = await db.finalEvaluationResult.findMany({ where: { cycleId, organizationId: orgId, status: { in: ['published', 'appealed'] } } });

    let created = 0;
    for (const result of results) {
      const calc = computeRecommendation(result.finalScore !== null ? Number(result.finalScore) : null, rules);
      if (!calc) continue;

      const existing = await db.compensationRecommendation.findFirst({ where: { cycleId, employeeId: result.employeeId, compensationPolicyId } });
      if (existing) continue;

      await db.compensationRecommendation.create({
        data: {
          organizationId: orgId,
          cycleId,
          employeeId: result.employeeId,
          compensationPolicyId,
          mode: 'policy',
          inputScore: result.finalScore,
          proposedType: calc.type,
          proposedValue: new Prisma.Decimal(calc.value),
          status: 'proposed',
          createdBy: auth.id,
        },
      });
      created += 1;
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'compensation_recommendations.generated', entityType: 'compensation_policy', entityId: compensationPolicyId, after: { created } }, req);
    sendData(res, { created, note: 'این موارد صرفاً پیشنهاد هستند و بدون تأیید انسانی اجرا نمی‌شوند.' }, 201);
  }),
);

compensationRouter.post(
  '/recommendations/:id/decision',
  requirePermission('compensation.approve'),
  validateBody(compensationDecisionSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const rec = await db.compensationRecommendation.findFirst({ where: { id, organizationId: orgId } });
    if (!rec) throw notFound();
    if (['approved', 'rejected', 'cancelled'].includes(rec.status)) throw conflict('این پیشنهاد قبلاً تصمیم‌گیری شده است.');

    const body = req.body as { decision: 'approved' | 'rejected'; reason?: string; isOverride: boolean; overrideReason?: string; overrideValue?: number | null };
    if (body.isOverride && !body.overrideReason) throw badRequest('برای اعمال تغییر، ثبت دلیل الزامی است.');

    await db.$transaction(async (tx) => {
      if (body.isOverride && body.overrideValue != null) {
        await tx.compensationRecommendation.update({ where: { id }, data: { proposedValue: new Prisma.Decimal(body.overrideValue) } });
      }
      await tx.compensationRecommendation.update({ where: { id }, data: { status: body.decision } });
      await tx.compensationApproval.create({
        data: {
          organizationId: orgId,
          recommendationId: id,
          approverId: auth.id,
          decision: body.decision,
          reason: body.reason ?? null,
          isOverride: body.isOverride,
          overrideReason: body.overrideReason ?? null,
        },
      });
    });

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'compensation_recommendation.decided', entityType: 'compensation_recommendation', entityId: id, after: { decision: body.decision, isOverride: body.isOverride } }, req);
    sendData(res, { ok: true, note: 'تصمیم ثبت شد؛ هیچ پرداخت یا تغییر حقوقی به‌صورت خودکار اجرا نمی‌شود.' });
  }),
);
