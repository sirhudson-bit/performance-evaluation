'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Select, Alert, Badge } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';

export interface AiProviderRow {
  id: number;
  name: string;
  type: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  enabled: boolean;
  isDefault: boolean;
  isFallback: boolean;
  models: { id: number; modelId: string; enabled: boolean }[];
}

/**
 * Row-level operations for a configured AI service: make it the default, toggle
 * it, edit it, probe connectivity, add a model, or delete it. Only serializable
 * props cross the server/client boundary.
 */
export function AiProviderActions({ provider }: { provider: AiProviderRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null);

  const [name, setName] = useState(provider.name);
  const [type, setType] = useState(provider.type);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [isFallback, setIsFallback] = useState(provider.isFallback);
  const [modelId, setModelId] = useState('');

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote({ type: 'success', text: ok });
      router.refresh();
    } catch (err) {
      setNote({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در انجام عملیات.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {provider.isDefault ? (
          <Badge tone="info">پیش‌فرض</Badge>
        ) : (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void act(() => apiClient('PATCH', `/ai/providers/${provider.id}`, { isDefault: true }), 'این سرویس به‌عنوان پیش‌فرض تنظیم شد.')}
          >
            تعیین به‌عنوان پیش‌فرض
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void act(() => apiClient('PATCH', `/ai/providers/${provider.id}`, { enabled: !provider.enabled }), provider.enabled ? 'سرویس غیرفعال شد.' : 'سرویس فعال شد.')}
        >
          {provider.enabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'بستن' : 'ویرایش'}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const res = await apiClient<{ supported?: boolean; detail?: string; models?: string[] }>('POST', `/ai/providers/${provider.id}/probe`);
              setNote({
                type: res.supported ? 'success' : 'info',
                text: res.supported
                  ? `اتصال برقرار شد${res.models?.length ? ` — ${res.models.length} مدل یافت شد` : ''}.`
                  : res.detail || 'نقطه پایانی /models پشتیبانی نشد؛ مدل را دستی وارد کنید.',
              });
            }, 'بررسی انجام شد.')
          }
        >
          بررسی اتصال
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm('این سرویس و مدل‌های آن حذف شود؟ این عمل بازگشت‌ناپذیر است.')) {
              void act(() => apiClient('DELETE', `/ai/providers/${provider.id}`), 'سرویس حذف شد.');
            }
          }}
        >
          حذف
        </Button>
      </div>

      {note ? <Alert variant={note.type}>{note.text}</Alert> : null}

      {open ? (
        <div className="space-y-3 rounded border border-slate-200 p-3 dark:border-slate-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام سرویس" htmlFor={`ai-name-${provider.id}`}>
              <Input id={`ai-name-${provider.id}`} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="نوع" htmlFor={`ai-type-${provider.id}`}>
              <Select id={`ai-type-${provider.id}`} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="openai_compatible">سازگار با OpenAI</option>
                <option value="google_gemini">Google Gemini</option>
                <option value="offline">محلی (بدون کلید)</option>
              </Select>
            </Field>
          </div>
          <Field label="آدرس پایه" htmlFor={`ai-url-${provider.id}`}>
            <Input id={`ai-url-${provider.id}`} dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </Field>
          <Field label="کلید API جدید" htmlFor={`ai-key-${provider.id}`} hint={`وضعیت کلید: ${provider.hasApiKey ? 'تنظیم‌شده (برای تغییر، مقدار جدید وارد کنید)' : 'تنظیم‌نشده'}`}>
            <PasswordInput id={`ai-key-${provider.id}`} dir="ltr" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="خالی بگذارید تا تغییر نکند" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFallback} onChange={(e) => setIsFallback(e.target.checked)} /> استفاده به‌عنوان سرویس جانشین (fallback)
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="افزودن مدل" htmlFor={`ai-model-${provider.id}`}>
              <Input id={`ai-model-${provider.id}`} dir="ltr" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="مثلاً gpt-4o-mini" />
            </Field>
            <Button
              variant="secondary"
              disabled={busy || modelId.trim().length === 0}
              onClick={() => void act(() => apiClient('POST', '/ai/models', { providerId: provider.id, modelId, timeoutMs: 30000, streaming: true, enabled: true }), 'مدل افزوده شد.').then(() => setModelId(''))}
            >
              افزودن
            </Button>
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              void act(
                () =>
                  apiClient('PATCH', `/ai/providers/${provider.id}`, {
                    name,
                    type,
                    baseUrl,
                    isFallback,
                    ...(apiKey ? { apiKey } : {}),
                  }),
                'تغییرات ذخیره شد.',
              )
            }
          >
            ذخیره تغییرات
          </Button>
        </div>
      ) : null}
    </div>
  );
}
