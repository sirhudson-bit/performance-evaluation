import { db } from '../db.js';
import { decryptSecret, encryptSecret } from './crypto.js';

/**
 * MeliPayamak integration.
 *
 * The panel's REST API accepts form-encoded POSTs at
 * `https://rest.payamak-panel.com/api/SendSMS/SendSMS` with
 * `username, password, to, from, text, isFlash`. Pattern (service) messages use
 * `.../BaseServiceNumber` with `bodyId` instead of `from`. Credentials are
 * stored encrypted with the same AES-GCM helper as AI API keys; the panel
 * password is never returned to the browser.
 *
 * @see https://www.melipayamak.com/api/
 */

export const DEFAULT_SMS_BASE_URL = 'https://rest.payamak-panel.com/api/SendSMS/SendSMS';
export const DEFAULT_OTP_TEXT = 'کد ورود شما به سامانه: {code}';

const KEY = {
  enabled: 'sms_enabled',
  username: 'sms_username',
  password: 'sms_password',
  from: 'sms_from',
  baseUrl: 'sms_base_url',
  otpEnabled: 'sms_otp_enabled',
  otpText: 'sms_otp_text',
  otpPatternId: 'sms_otp_pattern_id',
} as const;

export interface SmsSettings {
  enabled: boolean;
  username: string;
  password: string;
  from: string;
  baseUrl: string;
  otpEnabled: boolean;
  otpText: string;
  otpPatternId: string;
  hasPassword: boolean;
  configured: boolean;
}

export interface SmsSettingsInput {
  enabled: boolean;
  username?: string;
  password?: string;
  from?: string;
  baseUrl?: string;
  otpEnabled?: boolean;
  otpText?: string;
  otpPatternId?: string;
}

/** Converts Persian/Arabic digits and common +98 forms to `09xxxxxxxxx`. */
export function normalizePhone(input: string): string {
  const latin = input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\d+]/g, '');
  let digits = latin.replace(/^\+/, '');
  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.startsWith('98') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
}

export function isValidMobile(input: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(input));
}

export function otpMessage(template: string, code: string): string {
  return template.includes('{code}') ? template.replaceAll('{code}', code) : `${template} ${code}`;
}

function endpoint(baseUrl: string, operation: 'SendSMS' | 'BaseServiceNumber'): string {
  const base = (baseUrl || DEFAULT_SMS_BASE_URL).trim().replace(/\/+$/, '');
  if (base.endsWith('/SendSMS')) return `${base.slice(0, -'SendSMS'.length)}${operation}`;
  return `${base}/${operation}`;
}

/** Reads and decrypts settings. Decryption failure is reported, never thrown. */
export async function readSmsSettings(organizationId: number): Promise<SmsSettings> {
  const rows = await db.setting.findMany({
    where: { organizationId, key: { in: Object.values(KEY) } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  let password = '';
  let decryptError = false;
  const stored = map.get(KEY.password) ?? '';
  if (stored) {
    try {
      password = decryptSecret(stored);
    } catch {
      decryptError = true;
    }
  }

  const settings: SmsSettings = {
    enabled: map.get(KEY.enabled) === 'true',
    username: map.get(KEY.username) ?? '',
    password,
    from: map.get(KEY.from) ?? '',
    baseUrl: map.get(KEY.baseUrl) ?? DEFAULT_SMS_BASE_URL,
    otpEnabled: map.get(KEY.otpEnabled) !== 'false',
    otpText: map.get(KEY.otpText) ?? DEFAULT_OTP_TEXT,
    otpPatternId: map.get(KEY.otpPatternId) ?? '',
    hasPassword: Boolean(stored),
    configured: false,
  };
  settings.configured = settings.enabled && Boolean(settings.username && password && settings.from) && !decryptError;
  return settings;
}

/** Upserts settings; an omitted/blank password keeps the stored secret. */
export async function writeSmsSettings(organizationId: number, input: SmsSettingsInput): Promise<SmsSettings> {
  const values: Record<string, string> = {
    [KEY.enabled]: String(input.enabled),
    [KEY.username]: (input.username ?? '').trim(),
    [KEY.from]: (input.from ?? '').trim(),
    [KEY.baseUrl]: (input.baseUrl ?? '').trim() || DEFAULT_SMS_BASE_URL,
    [KEY.otpEnabled]: String(input.otpEnabled ?? true),
    [KEY.otpText]: (input.otpText ?? '').trim() || DEFAULT_OTP_TEXT,
    [KEY.otpPatternId]: (input.otpPatternId ?? '').trim(),
  };
  if (input.password) values[KEY.password] = encryptSecret(input.password);

  for (const [key, value] of Object.entries(values)) {
    await db.setting.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: { value },
      create: { organizationId, key, value },
    });
  }
  return readSmsSettings(organizationId);
}

export interface SmsResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/** Parses the panel's `{ Value, RetStatus, StrRetStatus }` envelope. */
export function parseProviderResponse(status: number, body: unknown): SmsResult {
  if (status < 200 || status >= 300) return { sent: false, error: `کد پاسخ سرویس پیامک: ${status}` };
  if (body === null || body === undefined) return { sent: false, error: 'پاسخ خالی از سرویس پیامک.' };

  const record = (typeof body === 'object' ? body : { Value: body }) as Record<string, unknown>;
  const ret = record.RetStatus ?? record.retStatus ?? record.status;
  const value = record.Value ?? record.value;
  const description = record.StrRetStatus ?? record.strRetStatus ?? record.message;

  if (ret !== undefined && Number(ret) !== 1) {
    return { sent: false, error: String(description ?? `کد وضعیت ${String(ret)}`) };
  }
  // A positive RecId means accepted; 0/negative/NaN means the panel rejected it.
  if (value === undefined || value === null || value === '') {
    return { sent: false, error: String(description ?? 'سرویس پیامک شناسه ارسال برنگرداند.') };
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric <= 0) {
    return { sent: false, error: String(description ?? 'سرویس پیامک ارسال را نپذیرفت.') };
  }
  return { sent: true, messageId: String(value) };
}

async function callProvider(url: string, payload: Record<string, string>): Promise<SmsResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError' ? 'پاسخی از سرویس پیامک دریافت نشد (۱۵ ثانیه).' : 'اتصال به سرویس پیامک برقرار نشد.';
    return { sent: false, error: message };
  }

  const raw = await response.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    /* Some failures return plain text; keep it below. */
  }
  const parsed = parseProviderResponse(response.status, body);
  if (!parsed.sent && typeof body === 'string' && body.trim()) {
    return { sent: false, error: `پاسخ نامعتبر سرویس پیامک: ${body.slice(0, 200)}` };
  }
  return parsed;
}

export interface SendSmsOptions {
  organizationId: number;
  to: string;
  text: string;
  kind: 'otp' | 'system' | 'test';
  senderUserId?: number | null;
  recipientUserId?: number | null;
  recipientName?: string | null;
  /** Use the configured pattern (bodyId) instead of a free-text message. */
  pattern?: boolean;
  /** Test sends work while the integration is disabled, so it can be verified. */
  ignoreEnabled?: boolean;
}

/**
 * Sends one SMS and always writes a delivery log. OTP bodies are redacted before
 * they reach the database; the plain code only exists in the outgoing request.
 */
export async function sendSms(options: SendSmsOptions): Promise<SmsResult> {
  const settings = await readSmsSettings(options.organizationId);
  const to = normalizePhone(options.to);
  const logText =
    options.kind === 'otp' ? 'کد ورود یک‌بارمصرف (متن به دلایل امنیتی ذخیره نشد)' : options.text;

  let result: SmsResult;
  if (!settings.username || !settings.password || !settings.from) {
    result = { sent: false, error: 'نام کاربری، رمز یا خط ارسال پنل پیامک تنظیم نشده است.' };
  } else if (!settings.enabled && !options.ignoreEnabled) {
    result = { sent: false, error: 'سرویس پیامک در تنظیمات غیرفعال است.' };
  } else if (!/^09\d{9}$/.test(to)) {
    result = { sent: false, error: 'شماره تلفن همراه گیرنده معتبر نیست.' };
  } else {
    const usePattern = options.pattern && Boolean(settings.otpPatternId);
    const payload: Record<string, string> = {
      username: settings.username,
      password: settings.password,
      to,
      text: options.text,
    };
    if (usePattern) payload.bodyId = settings.otpPatternId;
    else payload.from = settings.from;
    payload.isFlash = 'false';
    result = await callProvider(endpoint(settings.baseUrl, usePattern ? 'BaseServiceNumber' : 'SendSMS'), payload);
  }

  await db.smsMessage
    .create({
      data: {
        organizationId: options.organizationId,
        senderUserId: options.senderUserId ?? null,
        recipientUserId: options.recipientUserId ?? null,
        recipientName: options.recipientName ?? null,
        phone: to || options.to,
        text: logText,
        kind: options.kind,
        status: result.sent ? 'sent' : 'failed',
        providerMessageId: result.messageId ?? null,
        error: result.error ?? null,
      },
    })
    .catch((error: unknown) => {
      // A logging failure must not turn a delivered message into an error.
      console.error('[sms] failed to write delivery log:', error);
    });

  return result;
}
