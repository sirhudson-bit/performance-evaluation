'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select, Table, Td, Textarea } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { faDigits, formatJalali } from '@/lib/format';

export interface SmsSettingsView {
  enabled: boolean;
  username: string;
  from: string;
  baseUrl: string;
  otpEnabled: boolean;
  otpText: string;
  otpPatternId: string;
  hasPassword: boolean;
  configured: boolean;
  provider: string;
  docsUrl: string;
}

export interface Recipient {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  isManager: boolean;
  roles: string[];
}

export interface SmsLogRow {
  id: number;
  recipientName: string | null;
  phone: string;
  text: string;
  kind: string;
  status: string;
  providerMessageId: string | null;
  error: string | null;
  createdAt: string;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

const KIND_LABEL: Record<string, string> = {
  otp: 'کد ورود',
  system: 'پیام سامانه',
  test: 'آزمایشی',
};

export function SmsSettingsForm({ initial }: { initial: SmsSettingsView }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState('');
  const [from, setFrom] = useState(initial.from);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [otpEnabled, setOtpEnabled] = useState(initial.otpEnabled);
  const [otpText, setOtpText] = useState(initial.otpText);
  const [otpPatternId, setOtpPatternId] = useState(initial.otpPatternId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ sent: boolean; error?: string; messageId?: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiClient<{ settings: SmsSettingsView; note: string }>('PUT', '/admin/sms/settings', {
        enabled,
        username,
        ...(password ? { password } : {}),
        from,
        baseUrl,
        otpEnabled,
        otpText,
        otpPatternId,
      });
      setSettings(res.settings);
      setPassword('');
      setMessage({ type: 'success', text: res.note });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'danger', text: errorText(err, 'ذخیره تنظیمات پیامک ممکن نشد.') });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient<{ sent: boolean; error?: string; messageId?: string }>('POST', '/admin/sms/test', { to: testPhone });
      setTestResult(res);
      router.refresh();
    } catch (err) {
      setTestResult({ sent: false, error: errorText(err, 'ارسال پیام آزمایشی ممکن نشد.') });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="اتصال پنل پیامکی (ملی پیامک)"
          subtitle="اطلاعات حساب پنل پیامک؛ رمز فقط یک‌بار نوشته و رمزنگاری‌شده ذخیره می‌شود."
          actions={
            <>
              <Badge tone={settings.configured ? 'success' : 'muted'}>{settings.configured ? 'آماده ارسال' : 'تکمیل نشده'}</Badge>
              <Badge tone={enabled ? 'success' : 'muted'}>{enabled ? 'فعال' : 'غیرفعال'}</Badge>
            </>
          }
        />
        <CardBody>
          <form onSubmit={save} className="space-y-4">
            {message ? <Alert variant={message.type}>{message.text}</Alert> : null}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              ارسال پیامک از سامانه فعال باشد
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="نام کاربری پنل" htmlFor="sms-username" hint="نام کاربری ورود به پنل ملی پیامک." required>
                <Input id="sms-username" dir="ltr" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
              </Field>
              <Field label="خط ارسال" htmlFor="sms-from" hint="شماره خط اختصاصی، مثلاً 50004000." required>
                <Input id="sms-from" dir="ltr" inputMode="numeric" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
            </div>

            <Field
              label="رمز عبور پنل"
              htmlFor="sms-password"
              hint={settings.hasPassword ? 'رمز ذخیره شده است؛ برای تغییر، رمز جدید را وارد کنید. خالی گذاشتن یعنی بدون تغییر.' : 'رمز عبور پنل پیامک.'}
            >
              <PasswordInput
                id="sms-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={settings.hasPassword ? '••••••••••••' : 'رمز پنل'}
              />
            </Field>

            <Field label="آدرس وب‌سرویس" htmlFor="sms-base" hint="در صورت نیاز به سرویس دیگری قابل تغییر است؛ پیش‌فرض، REST ملی پیامک.">
              <Input id="sms-base" dir="ltr" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
            </Field>

            <div className="rounded border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">رمز یک‌بار مصرف ورود</h3>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={otpEnabled} onChange={(event) => setOtpEnabled(event.target.checked)} />
                ورود با رمز یک‌بار مصرف فعال باشد
              </label>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="متن پیامک کد" htmlFor="sms-otp-text" hint="جای‌نگهدار {code} با کد شش‌رقمی جایگزین می‌شود.">
                  <Input id="sms-otp-text" value={otpText} onChange={(event) => setOtpText(event.target.value)} />
                </Field>
                <Field label="شناسه الگو (اختیاری)" htmlFor="sms-otp-pattern" hint="اگر در پنل، الگوی خدماتی ساخته‌اید، bodyId آن را وارد کنید.">
                  <Input id="sms-otp-pattern" dir="ltr" inputMode="numeric" value={otpPatternId} onChange={(event) => setOtpPatternId(event.target.value)} />
                </Field>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                برای تحویل بهتر کد ورود، استفاده از «الگوی خدماتی» پنل ملی پیامک توصیه می‌شود؛ در این حالت متن الگو در پنل تعیین می‌شود.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره تنظیمات پیامک'}</Button>
              <a href={settings.docsUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline">
                مستندات ملی پیامک
              </a>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="ارسال پیام آزمایشی" subtitle="پیش از استفاده واقعی، اتصال حساب و خط ارسال را بررسی کنید." />
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="شماره همراه" htmlFor="sms-test-phone">
              <Input id="sms-test-phone" dir="ltr" inputMode="numeric" placeholder="09121234567" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} />
            </Field>
            <Button type="button" variant="secondary" onClick={() => void sendTest()} disabled={testing || testPhone.length < 10}>
              {testing ? 'در حال ارسال…' : 'ارسال پیام آزمایشی'}
            </Button>
          </div>
          {testResult ? (
            <div className="mt-3">
              {testResult.sent ? (
                <Alert variant="success">پیام آزمایشی ارسال شد{testResult.messageId ? ` (شناسه ${faDigits(testResult.messageId)})` : ''}.</Alert>
              ) : (
                <Alert variant="danger">ارسال آزمایشی ناموفق بود: {testResult.error ?? 'خطای نامشخص'}</Alert>
              )}
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

export function SmsComposer({ recipients }: { recipients: Recipient[] }) {
  const router = useRouter();
  const [audience, setAudience] = useState('managers');
  const [userId, setUserId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number; failures: { name: string; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const managers = recipients.filter((recipient) => recipient.isManager);
  const staff = recipients.filter((recipient) => !recipient.isManager);
  const count = audience === 'all' ? recipients.length : audience === 'managers' ? managers.length : audience === 'staff' ? staff.length : userId ? 1 : 0;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (!text.trim()) {
      setError('متن پیام را وارد کنید.');
      return;
    }
    if (audience === 'user' && !userId) {
      setError('کاربر گیرنده را انتخاب کنید.');
      return;
    }
    if (!window.confirm(`این پیام برای ${faDigits(count)} گیرنده ارسال شود؟`)) return;

    setBusy(true);
    try {
      const res = await apiClient<{ sent: number; failed: number; total: number; failures: { name: string; error: string }[] }>('POST', '/admin/sms/send', {
        audience,
        ...(audience === 'user' ? { userId: Number(userId) } : {}),
        text,
      });
      setResult(res);
      router.refresh();
    } catch (err) {
      setError(errorText(err, 'ارسال پیام ممکن نشد.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="ارسال پیام سامانه" subtitle="پیام برای مدیران، کارکنان یا یک کاربر مشخص ارسال می‌شود." />
      <CardBody>
        <form onSubmit={send} className="space-y-4">
          {error ? <Alert variant="danger">{error}</Alert> : null}
          {result ? (
            <Alert variant={result.failed === 0 ? 'success' : result.sent > 0 ? 'warning' : 'danger'}>
              {faDigits(result.sent)} از {faDigits(result.total)} پیام ارسال شد{result.failed ? `؛ ${faDigits(result.failed)} مورد ناموفق بود.` : '.'}
              {result.failures.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {result.failures.map((failure) => (
                    <li key={`${failure.name}-${failure.error}`}>{failure.name}: {failure.error}</li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="گیرندگان" htmlFor="sms-audience">
              <Select id="sms-audience" value={audience} onChange={(event) => setAudience(event.target.value)}>
                <option value="managers">مدیران ({faDigits(managers.length)})</option>
                <option value="staff">کارکنان ({faDigits(staff.length)})</option>
                <option value="all">همه کاربران ({faDigits(recipients.length)})</option>
                <option value="user">یک کاربر مشخص</option>
              </Select>
            </Field>
            {audience === 'user' ? (
              <Field label="کاربر" htmlFor="sms-user">
                <Select id="sms-user" value={userId} onChange={(event) => setUserId(event.target.value)}>
                  <option value="">انتخاب کنید…</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.name} — {recipient.phone}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="flex items-end text-xs text-slate-500 dark:text-slate-400">
                فقط کاربران فعال دارای شماره همراه دریافت می‌کنند.
              </div>
            )}
          </div>

          <Field label="متن پیام" htmlFor="sms-text" hint={`${faDigits(text.length)} از ۵۰۰ نویسه`}>
            <Textarea id="sms-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={500} rows={4} />
          </Field>

          <Button type="submit" disabled={busy || count === 0}>{busy ? 'در حال ارسال…' : `ارسال به ${faDigits(count)} گیرنده`}</Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function SmsLogs({ rows }: { rows: SmsLogRow[] }) {
  return (
    <Card>
      <CardHeader title="گزارش ارسال‌ها" subtitle="آخرین پیام‌های ارسالی سامانه؛ متن کد ورود ذخیره نمی‌شود." />
      {rows.length === 0 ? (
        <CardBody><p className="text-sm text-slate-500">هنوز پیامی ارسال نشده است.</p></CardBody>
      ) : (
        <Table head={['زمان', 'گیرنده', 'شماره', 'نوع', 'وضعیت', 'شناسه/خطا']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="whitespace-nowrap text-xs">{formatJalali(row.createdAt, { withTime: true })}</Td>
              <Td>{row.recipientName ?? '—'}</Td>
              <Td dir="ltr" className="text-xs">{row.phone}</Td>
              <Td className="text-xs">{KIND_LABEL[row.kind] ?? row.kind}</Td>
              <Td>{row.status === 'sent' ? <Badge tone="success">ارسال شد</Badge> : <Badge tone="danger">ناموفق</Badge>}</Td>
              <Td dir="ltr" className="max-w-56 break-all text-xs text-slate-500">{row.error ?? row.providerMessageId ?? '—'}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
