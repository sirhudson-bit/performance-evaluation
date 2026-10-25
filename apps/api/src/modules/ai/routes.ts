import { Router } from 'express';
import { aiProviderSchema, aiProviderUpdateSchema, aiModelSchema, aiChatSchema, aiUseCaseSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, notFound, sendData } from '../../lib/http.js';
import { encryptSecret, maskSecret } from '../../lib/crypto.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { chat, probeProvider, isFeatureEnabled } from '../../lib/ai/service.js';

export const aiRouter = Router();

function publicProvider(p: {
  id: number;
  name: string;
  type: string;
  baseUrl: string | null;
  encryptedApiKey: string | null;
  enabled: boolean;
  isDefault: boolean;
  isFallback: boolean;
  config: unknown;
  models?: { id: number; modelId: string; label: string | null; enabled: boolean; streaming: boolean }[];
}) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    baseUrl: p.baseUrl,
    hasApiKey: Boolean(p.encryptedApiKey),
    // The key is never returned — only a masked fingerprint.
    apiKeyMasked: p.encryptedApiKey ? maskSecret('••••••••••••') : null,
    enabled: p.enabled,
    isDefault: p.isDefault,
    isFallback: p.isFallback,
    config: p.config,
    models: p.models ?? [],
  };
}

// --- Providers -------------------------------------------------------------
aiRouter.get(
  '/providers',
  requirePermission('ai.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.aiProvider.findMany({ where: { organizationId: orgId }, include: { models: true }, orderBy: { id: 'asc' } });
    // The default GapGPT base URL is suggested (never assumed to be supported).
    sendData(res, { items: items.map(publicProvider), suggestedBaseUrl: 'https://api.gapgpt.app/v1' });
  }),
);

aiRouter.post(
  '/providers',
  requirePermission('ai.manage'),
  validateBody(aiProviderSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;

    const provider = await db.aiProvider.create({
      data: {
        organizationId: orgId,
        name: body.name as string,
        type: body.type as string,
        baseUrl: (body.baseUrl as string) ?? null,
        encryptedApiKey: body.apiKey ? encryptSecret(body.apiKey as string) : null,
        enabled: body.enabled as boolean,
        isDefault: body.isDefault as boolean,
        isFallback: body.isFallback as boolean,
        config: (body.config ?? {}) as object,
      },
    });

    if (body.isDefault) {
      await db.aiProvider.updateMany({ where: { organizationId: orgId, id: { not: provider.id } }, data: { isDefault: false } });
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'ai_provider.created', entityType: 'ai_provider', entityId: provider.id, after: { name: provider.name, type: provider.type } }, req);
    sendData(res, { id: provider.id }, 201);
  }),
);

aiRouter.patch(
  '/providers/:id',
  requirePermission('ai.manage'),
  validateBody(aiProviderUpdateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const provider = await db.aiProvider.findFirst({ where: { id, organizationId: orgId } });
    if (!provider) throw notFound();
    const body = req.body as Record<string, unknown>;

    await db.aiProvider.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name as string } : {}),
        ...(body.type !== undefined ? { type: body.type as string } : {}),
        ...(body.baseUrl !== undefined ? { baseUrl: (body.baseUrl as string) ?? null } : {}),
        ...(body.apiKey !== undefined ? { encryptedApiKey: body.apiKey ? encryptSecret(body.apiKey as string) : null } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled as boolean } : {}),
        ...(body.isFallback !== undefined ? { isFallback: body.isFallback as boolean } : {}),
        ...(body.config !== undefined ? { config: body.config as object } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault as boolean } : {}),
      },
    });

    if (body.isDefault === true) {
      await db.aiProvider.updateMany({ where: { organizationId: orgId, id: { not: id } }, data: { isDefault: false } });
    }

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'ai_provider.updated', entityType: 'ai_provider', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);

aiRouter.delete(
  '/providers/:id',
  requirePermission('ai.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const provider = await db.aiProvider.findFirst({ where: { id, organizationId: orgId } });
    if (!provider) throw notFound();
    await db.aiProvider.delete({ where: { id } });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'ai_provider.deleted', entityType: 'ai_provider', entityId: id }, req);
    sendData(res, { ok: true });
  }),
);

aiRouter.post(
  '/providers/:id/probe',
  requirePermission('ai.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const result = await probeProvider(orgId, id);
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'ai_provider.probed', entityType: 'ai_provider', entityId: id, after: { supported: result.supported } }, req);
    sendData(res, result);
  }),
);

// --- Models ----------------------------------------------------------------
aiRouter.post(
  '/models',
  requirePermission('ai.manage'),
  validateBody(aiModelSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { providerId: number; modelId: string; label?: string; maxTokens?: number; temperature?: number; timeoutMs: number; streaming: boolean; enabled: boolean };

    const provider = await db.aiProvider.findFirst({ where: { id: body.providerId, organizationId: orgId } });
    if (!provider) throw notFound();

    const model = await db.aiModelConfiguration.upsert({
      where: { providerId_modelId: { providerId: body.providerId, modelId: body.modelId } },
      update: { label: body.label ?? null, maxTokens: body.maxTokens ?? null, temperature: body.temperature ?? null, timeoutMs: body.timeoutMs, streaming: body.streaming, enabled: body.enabled },
      create: { providerId: body.providerId, modelId: body.modelId, label: body.label ?? null, maxTokens: body.maxTokens ?? null, temperature: body.temperature ?? null, timeoutMs: body.timeoutMs, streaming: body.streaming, enabled: body.enabled },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'ai_model.saved', entityType: 'ai_model_configuration', entityId: model.id }, req);
    sendData(res, { id: model.id }, 201);
  }),
);

// --- Use-case policies -----------------------------------------------------
aiRouter.get(
  '/use-cases',
  requirePermission('ai.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.aiUseCasePolicy.findMany({ where: { organizationId: orgId } });
    sendData(res, { items });
  }),
);

aiRouter.put(
  '/use-cases',
  requirePermission('ai.manage'),
  validateBody(aiUseCaseSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { feature: string; enabled: boolean; dataCategories: string[]; minRoleKey?: string | null; notes?: string };

    await db.aiUseCasePolicy.upsert({
      where: { organizationId_feature: { organizationId: orgId, feature: body.feature } },
      update: { enabled: body.enabled, dataCategories: body.dataCategories, minRoleKey: body.minRoleKey ?? null, notes: body.notes ?? null },
      create: { organizationId: orgId, feature: body.feature, enabled: body.enabled, dataCategories: body.dataCategories, minRoleKey: body.minRoleKey ?? null, notes: body.notes ?? null },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'ai_use_case.updated', entityType: 'ai_use_case_policy', entityId: body.feature, after: { enabled: body.enabled, dataCategories: body.dataCategories } }, req);
    sendData(res, { ok: true });
  }),
);

// --- Usage -----------------------------------------------------------------
aiRouter.get(
  '/usage',
  requirePermission('ai.view_usage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const events = await db.aiUsageEvent.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 200 });
    const totals = {
      requests: events.length,
      errors: events.filter((e) => e.status === 'error').length,
      tokens: events.reduce((sum, e) => sum + (e.tokensIn ?? 0) + (e.tokensOut ?? 0), 0),
    };
    sendData(res, { events, totals });
  }),
);

// --- Chat ------------------------------------------------------------------
aiRouter.get(
  '/status',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const enabled = await isFeatureEnabled(orgId, 'chat');
    const provider = await db.aiProvider.findFirst({ where: { organizationId: orgId, enabled: true } });
    sendData(res, { enabled, configured: Boolean(provider), providerName: provider?.name ?? null });
  }),
);

aiRouter.post(
  '/chat',
  requirePermission('ai.use'),
  aiLimiter,
  validateBody(aiChatSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { conversationId, message } = req.body as { conversationId?: number | null; message: string };

    // Persist the user turn (history retention is an admin-configurable policy).
    let conversation = conversationId
      ? await db.aiConversation.findFirst({ where: { id: conversationId, userId: auth.id, organizationId: orgId } })
      : null;
    if (!conversation) {
      conversation = await db.aiConversation.create({ data: { organizationId: orgId, userId: auth.id, title: message.slice(0, 60) } });
    }
    await db.aiMessage.create({ data: { conversationId: conversation.id, role: 'user', content: message } });

    const result = await chat({ organizationId: orgId, userId: auth.id, message });

    await db.aiMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: result.reply } });

    sendData(res, { conversationId: conversation.id, ...result });
  }),
);

aiRouter.get(
  '/conversations',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const items = await db.aiConversation.findMany({ where: { userId: auth.id }, orderBy: { updatedAt: 'desc' }, take: 30, include: { _count: { select: { messages: true } } } });
    sendData(res, { items });
  }),
);

aiRouter.get(
  '/conversations/:id',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const conv = await db.aiConversation.findFirst({ where: { id: Number(req.params.id), userId: auth.id }, include: { messages: { orderBy: { id: 'asc' } } } });
    if (!conv) throw notFound();
    sendData(res, { conversation: conv });
  }),
);

aiRouter.delete(
  '/conversations/:id',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const conv = await db.aiConversation.findFirst({ where: { id: Number(req.params.id), userId: auth.id } });
    if (!conv) throw notFound();
    await db.aiConversation.delete({ where: { id: conv.id } });
    sendData(res, { ok: true });
  }),
);
