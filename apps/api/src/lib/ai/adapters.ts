/**
 * AI provider adapters.
 *
 * Each adapter implements the documented capabilities of one provider shape.
 * Nothing assumes that a provider is OpenAI-compatible: the `openai_compatible`
 * adapter is used only when the administrator chooses that type, and model
 * discovery is attempted but never required (if `/models` is unsupported the
 * admin configures the model manually).
 *
 * No adapter is called without an explicit, admin-enabled provider and — for
 * features that touch personal data — an enabled use-case policy.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderConfig {
  type: string; // openai_compatible | google_gemini | offline
  baseUrl: string | null;
  apiKey: string | null;
  config: Record<string, unknown>;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  stream?: boolean;
}

export interface ChatResult {
  content: string;
  tokensIn?: number;
  tokensOut?: number;
}

export class ProviderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderError('timeout', 'پاسخی از سرویس هوش مصنوعی دریافت نشد (مهلت تمام شد).');
    }
    throw new ProviderError('network', 'ارتباط با سرویس هوش مصنوعی برقرار نشد.');
  } finally {
    clearTimeout(timer);
  }
}

export async function adapterChat(
  provider: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<ChatResult> {
  const timeoutMs = opts.timeoutMs ?? 30000;

  if (provider.type === 'offline') {
    return offlineChat(messages);
  }

  if (!provider.apiKey) {
    throw new ProviderError('not_configured', 'کلید API این سرویس تنظیم نشده است.');
  }

  if (provider.type === 'openai_compatible') {
    const base = (provider.baseUrl || 'https://api.gapgpt.app/v1').replace(/\/+$/, '');
    const response = await fetchWithTimeout(
      `${base}/chat/completions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens,
          stream: false,
        }),
      },
      timeoutMs,
    );

    if (!response.ok) {
      throw new ProviderError('provider_error', `سرویس هوش مصنوعی خطا برگرداند (کد ${response.status}).`);
    }
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? '';
    return { content, tokensIn: json.usage?.prompt_tokens, tokensOut: json.usage?.completion_tokens };
  }

  if (provider.type === 'google_gemini') {
    const base = (provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const response = await fetchWithTimeout(
      `${base}/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          ...(messages.find((m) => m.role === 'system')
            ? { systemInstruction: { parts: [{ text: messages.find((m) => m.role === 'system')?.content ?? '' }] } }
            : {}),
        }),
      },
      timeoutMs,
    );
    if (!response.ok) {
      throw new ProviderError('provider_error', `سرویس هوش مصنوعی خطا برگرداند (کد ${response.status}).`);
    }
    const json = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const content = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return { content };
  }

  throw new ProviderError('unsupported', 'نوع سرویس پشتیبانی نمی‌شود.');
}

/**
 * Attempts model discovery. Returns `supported:false` when the provider does not
 * expose a `/models` endpoint, so the caller falls back to manual configuration
 * rather than assuming OpenAI semantics.
 */
export async function adapterListModels(
  provider: ProviderConfig,
): Promise<{ supported: boolean; models: string[]; note?: string }> {
  if (provider.type === 'offline') return { supported: true, models: ['offline-rule-based'], note: 'سرویس محلی بدون نیاز به کلید.' };
  if (!provider.apiKey) return { supported: false, models: [], note: 'کلید API تنظیم نشده است.' };

  try {
    if (provider.type === 'openai_compatible') {
      const base = (provider.baseUrl || 'https://api.gapgpt.app/v1').replace(/\/+$/, '');
      const response = await fetchWithTimeout(`${base}/models`, { headers: { Authorization: `Bearer ${provider.apiKey}` } }, 8000);
      if (!response.ok) return { supported: false, models: [], note: `فهرست مدل‌ها در دسترس نیست (کد ${response.status}).` };
      const json = (await response.json()) as { data?: { id?: string }[] };
      return { supported: true, models: (json.data ?? []).map((m) => m.id ?? '').filter(Boolean) };
    }
    if (provider.type === 'google_gemini') {
      const base = (provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
      const response = await fetchWithTimeout(`${base}/models?key=${encodeURIComponent(provider.apiKey)}`, {}, 8000);
      if (!response.ok) return { supported: false, models: [], note: `فهرست مدل‌ها در دسترس نیست (کد ${response.status}).` };
      const json = (await response.json()) as { models?: { name?: string }[] };
      return { supported: true, models: (json.models ?? []).map((m) => (m.name ?? '').replace(/^models\//, '')).filter(Boolean) };
    }
  } catch (error) {
    return { supported: false, models: [], note: error instanceof Error ? error.message : 'کشف مدل ناموفق بود.' };
  }
  return { supported: false, models: [] };
}

/** Offline fallback: no external call, no personal data leaves the server. */
function offlineChat(messages: ChatMessage[]): ChatResult {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  return {
    content:
      'دستیار محلی (بدون اتصال به سرویس بیرونی):\n' +
      `پرسش شما: «${last.slice(0, 200)}»\n\n` +
      'برای پاسخ‌های دقیق‌تر، بخش «راهنما» را ببینید یا از مدیر سامانه بخواهید یک سرویس هوش مصنوعی را در تنظیمات فعال کند. ' +
      'این پاسخ مبتنی بر قواعد محلی است و ممکن است کامل نباشد.',
  };
}
