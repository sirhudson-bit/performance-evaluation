import { db } from '../../db.js';
import { decryptSecret, maskSecret } from '../crypto.js';
import { config } from '../../config.js';
import { adapterChat, adapterListModels, type ChatMessage, type ProviderConfig } from './adapters.js';
import { serviceUnavailable } from '../http.js';

/**
 * AI orchestration.
 *
 * Authorization is applied *before* any context is built, and only the data
 * categories an administrator has allowed for a feature are ever placed in the
 * prompt. Usage is logged without prompt content. Nothing here can decide an
 * employee's rating, promotion or salary — the assistant only explains rules and
 * summarizes information the caller is already allowed to see.
 */

export interface ResolvedProvider {
  id: number;
  name: string;
  type: string;
  baseUrl: string | null;
  config: ProviderConfig;
  defaultModel: string | null;
}

export async function resolveProvider(organizationId: number, providerId?: number): Promise<ResolvedProvider | null> {
  const provider = providerId
    ? await db.aiProvider.findFirst({ where: { id: providerId, organizationId }, include: { models: true } })
    : (await db.aiProvider.findFirst({ where: { organizationId, enabled: true, isDefault: true }, include: { models: true } })) ??
      (await db.aiProvider.findFirst({ where: { organizationId, enabled: true }, orderBy: { id: 'asc' }, include: { models: true } }));

  if (!provider) return null;

  let apiKey: string | null = null;
  if (provider.encryptedApiKey) {
    try {
      apiKey = decryptSecret(provider.encryptedApiKey);
    } catch {
      apiKey = null; // unreadable key → treated as not configured, surfaced as advice
    }
  }

  const enabledModel = provider.models.find((m) => m.enabled) ?? provider.models[0] ?? null;

  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl,
    config: { type: provider.type, baseUrl: provider.baseUrl, apiKey, config: (provider.config ?? {}) as Record<string, unknown> },
    defaultModel: enabledModel?.modelId ?? null,
  };
}

export async function probeProvider(organizationId: number, providerId: number) {
  const resolved = await resolveProvider(organizationId, providerId);
  if (!resolved) throw serviceUnavailable('سرویس انتخاب‌شده یافت نشد.');
  return adapterListModels(resolved.config);
}

export async function isFeatureEnabled(organizationId: number, feature: string): Promise<boolean> {
  const policy = await db.aiUseCasePolicy.findUnique({ where: { organizationId_feature: { organizationId, feature } } });
  return Boolean(policy?.enabled);
}

export async function recordUsage(params: {
  organizationId: number;
  userId: number | null;
  providerId: number | null;
  modelId: string | null;
  feature: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  status: string;
  errorCode?: string | null;
}): Promise<void> {
  await db.aiUsageEvent.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      providerId: params.providerId,
      modelId: params.modelId,
      feature: params.feature,
      tokensIn: params.tokensIn ?? null,
      tokensOut: params.tokensOut ?? null,
      latencyMs: params.latencyMs ?? null,
      status: params.status,
      errorCode: params.errorCode ?? null,
    },
  });
}

/** Builds the (minimal) system prompt. Help content only, unless a policy allows more. */
export async function buildChatContext(organizationId: number, feature: string): Promise<ChatMessage[]> {
  const policy = await db.aiUseCasePolicy.findUnique({ where: { organizationId_feature: { organizationId, feature } } });
  const allowed = new Set((policy?.dataCategories as string[] | undefined) ?? ['help_content']);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        `تو دستیار «${config.APP_NAME}» هستی. فقط به زبان فارسی پاسخ بده. ` +
        'تو مجاز نیستی درباره امتیاز، ارتقا، افزایش حقوق یا تنبیه کارکنان تصمیم بگیری یا عدد قطعی تعیین کنی؛ ' +
        'فقط قواعد و اطلاعاتِ در دسترسِ کاربر را توضیح بده و در موارد تصمیم‌گیری، کاربر را به فرد مسئول ارجاع بده. ' +
        'اگر اطلاعات کافی نداری، صادقانه بگو و حدس قطعی نزن.',
    },
  ];

  if (allowed.has('help_content')) {
    const articles = await db.helpArticle.findMany({ where: { organizationId, status: 'published' }, select: { title: true, summary: true }, take: 12 });
    if (articles.length > 0) {
      const context = articles.map((a) => `• ${a.title}: ${a.summary ?? ''}`).join('\n');
      messages.push({ role: 'system', content: `محتوای راهنمای سامانه (برای زمینه):\n${context}` });
    }
  }

  return messages;
}

export async function chat(params: {
  organizationId: number;
  userId: number;
  providerId?: number;
  model?: string;
  message: string;
  feature?: string;
}): Promise<{ reply: string; provider: string | null; model: string | null; note: string }> {
  const feature = params.feature ?? 'chat';

  if (!(await isFeatureEnabled(params.organizationId, feature))) {
    throw serviceUnavailable('دستیار هوشمند برای این کاربرد فعال نشده است. مدیر سامانه می‌تواند آن را در تنظیمات فعال کند.');
  }

  const resolved = await resolveProvider(params.organizationId, params.providerId);
  if (!resolved) throw serviceUnavailable('هیچ سرویس هوش مصنوعی فعالی تنظیم نشده است.');

  const model = params.model ?? resolved.defaultModel;
  if (!model) throw serviceUnavailable('مدلی برای این سرویس انتخاب نشده است.');

  const context = await buildChatContext(params.organizationId, feature);
  const messages: ChatMessage[] = [...context, { role: 'user', content: params.message.slice(0, 4000) }];

  const started = Date.now();
  try {
    const result = await adapterChat(resolved.config, messages, { model, timeoutMs: 30000 });
    await recordUsage({
      organizationId: params.organizationId,
      userId: params.userId,
      providerId: resolved.id,
      modelId: model,
      feature,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs: Date.now() - started,
      status: 'ok',
    });
    return {
      reply: result.content,
      provider: resolved.name,
      model,
      note: 'این پاسخ توسط هوش مصنوعی تولید شده و ممکن است نادرست باشد؛ تصمیم‌های نهایی با انسان است.',
    };
  } catch (error) {
    await recordUsage({
      organizationId: params.organizationId,
      userId: params.userId,
      providerId: resolved.id,
      modelId: model,
      feature,
      latencyMs: Date.now() - started,
      status: 'error',
      errorCode: error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'error',
    });
    throw serviceUnavailable(error instanceof Error ? error.message : 'خطا در ارتباط با سرویس هوش مصنوعی.');
  }
}

export { maskSecret };
