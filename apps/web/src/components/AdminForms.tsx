'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Textarea, Select, Alert } from '@/components/ui';
import { JalaliDateInput } from '@/components/JalaliDateInput';

function useSubmit() {
  const router = useRouter();
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ type: 'success', text: success });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در انجام عملیات.' });
    } finally {
      setBusy(false);
    }
  }
  return { message, busy, run };
}

export function UserForm({ roles, departments }: { roles: { id: number; name: string; isProtected: boolean }[]; departments: { id: number; name: string }[] }) {
  const { message, busy, run } = useSubmit();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleIds, setRoleIds] = useState<number[]>([]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await apiClient('POST', '/users', { name, email, roleIds, status: 'active', departmentId: departmentId ? Number(departmentId) : null });
          setName('');
          setEmail('');
          setRoleIds([]);
          setDepartmentId('');
        }, 'کاربر ایجاد شد.');
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="نام" htmlFor="u-name" required><Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="ایمیل" htmlFor="u-email" required><Input id="u-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label="دپارتمان / واحد کاری" htmlFor="u-dept">
        <Select id="u-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">بدون واحد</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </Field>
      <Field label="نقش‌ها" hint="نقش محافظت‌شده قابل واگذاری نیست.">
        <div className="flex flex-wrap gap-2">
          {roles.filter((r) => !r.isProtected).map((r) => (
            <label key={r.id} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700">
              <input type="checkbox" checked={roleIds.includes(r.id)} onChange={(e) => setRoleIds((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)))} />
              {r.name}
            </label>
          ))}
        </div>
      </Field>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ایجاد کاربر'}</Button>
      <p className="text-xs text-slate-500">در صورت خالی‌بودن رمز، یک رمز موقت تولید و یک‌بار نمایش داده می‌شود.</p>
    </form>
  );
}

interface EditUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  department: { id: number } | null;
  roles: { role: { id: number; name: string } }[];
}

export function UserEditForm({ user, roles, departments, onDone }: { user: EditUser; roles: { id: number; name: string; isProtected: boolean }[]; departments: { id: number; name: string }[]; onDone?: () => void }) {
  const { message, busy, run } = useSubmit();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [status, setStatus] = useState(user.status);
  const [departmentId, setDepartmentId] = useState(user.department ? String(user.department.id) : '');
  const [roleIds, setRoleIds] = useState<number[]>(user.roles.map((r) => r.role.id));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await apiClient('PATCH', `/users/${user.id}`, {
            name,
            email,
            phone: phone || undefined,
            status,
            departmentId: departmentId ? Number(departmentId) : null,
            roleIds,
          });
          onDone?.();
        }, 'ذخیره شد.');
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام" htmlFor={`eu-name-${user.id}`}><Input id={`eu-name-${user.id}`} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="ایمیل" htmlFor={`eu-email-${user.id}`}><Input id={`eu-email-${user.id}`} dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="تلفن" htmlFor={`eu-phone-${user.id}`}><Input id={`eu-phone-${user.id}`} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="وضعیت" htmlFor={`eu-status-${user.id}`}><Select id={`eu-status-${user.id}`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">فعال</option><option value="suspended">معلق</option><option value="archived">بایگانی</option>
        </Select></Field>
      </div>
      <Field label="دپارتمان" htmlFor={`eu-dept-${user.id}`}>
        <Select id={`eu-dept-${user.id}`} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">بدون واحد</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </Field>
      <Field label="نقش‌ها">
        <div className="flex flex-wrap gap-2">
          {roles.filter((r) => !r.isProtected).map((r) => (
            <label key={r.id} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700">
              <input type="checkbox" checked={roleIds.includes(r.id)} onChange={(e) => setRoleIds((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)))} />
              {r.name}
            </label>
          ))}
        </div>
      </Field>
      <Button type="submit" variant="secondary" disabled={busy}>{busy ? '…' : 'ذخیره تغییرات'}</Button>
    </form>
  );
}

/**
 * Row action for the users table. It is a Client Component that receives only
 * serializable props (a render *function* cannot cross the server/client
 * boundary), and owns the open/close state of the inline edit form. It also
 * provides password-reset and delete actions.
 */
export function UserRowActions({
  user,
  roles,
  departments,
  isSelf,
}: {
  user: EditUser;
  roles: { id: number; name: string; isProtected: boolean }[];
  departments: { id: number; name: string }[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

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
        <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'بستن' : 'ویرایش'}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const res = await apiClient<{ link: string; emailed: boolean }>('POST', `/users/${user.id}/reset-password`);
              // Never reveals the existing password — only a single-use reset link.
              setNote({
                type: 'success',
                text: res.emailed ? 'پیوند بازنشانی به ایمیل کاربر ارسال شد.' : `پیوند بازنشانی (یک‌بارمصرف): ${res.link}`,
              });
            }, 'پیوند بازنشانی صادر شد.')
          }
        >
          بازنشانی رمز
        </Button>
        {isSelf ? null : (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm('این کاربر برای همیشه حذف شود؟ نشست‌های فعال نیز بسته می‌شوند.')) {
                void act(() => apiClient('DELETE', `/users/${user.id}?hard=1`), 'کاربر حذف شد.');
              }
            }}
          >
            حذف
          </Button>
        )}
      </div>
      {note ? (
        <Alert variant={note.type}>
          <span className="break-all" dir="ltr">
            {note.text}
          </span>
        </Alert>
      ) : null}
      {open ? (
        <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
          <UserEditForm user={user} roles={roles} departments={departments} onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

export function QuestionForm({ categories }: { categories: { id: number; name: string }[] }) {
  const { message, busy, run } = useSubmit();
  const [stableKey, setStableKey] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [answerType, setAnswerType] = useState('rating_5');
  const [weight, setWeight] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [options, setOptions] = useState<{ label: string; value: string; score: string }[]>([{ label: '', value: '', score: '' }]);

  const isChoice = ['rating_5', 'single_choice', 'multi_choice', 'yes_no'].includes(answerType);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await apiClient('POST', '/questions', {
            stableKey,
            title,
            text,
            answerType,
            weight: Number(weight),
            categoryId: categoryId ? Number(categoryId) : null,
            respondentRoles: ['manager', 'self'],
            required: true,
            status: 'active',
            options: isChoice ? options.filter((o) => o.label).map((o, i) => ({ label: o.label, value: o.value || String(i + 1), score: o.score ? Number(o.score) : null, isNotApplicable: false, sortOrder: i })) : [],
            scoring: {},
          });
          setStableKey('');
          setTitle('');
          setText('');
          setOptions([{ label: '', value: '', score: '' }]);
        }, 'پرسش ایجاد شد.');
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="شناسه پایدار" htmlFor="q-key" hint="فقط حروف کوچک انگلیسی، رقم و زیرخط." required><Input id="q-key" dir="ltr" value={stableKey} onChange={(e) => setStableKey(e.target.value)} required /></Field>
      <Field label="عنوان" htmlFor="q-title" required><Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="متن پرسش" htmlFor="q-text" required><Textarea id="q-text" value={text} onChange={(e) => setText(e.target.value)} required /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="نوع پاسخ" htmlFor="q-type"><Select id="q-type" value={answerType} onChange={(e) => setAnswerType(e.target.value)}>
          <option value="rating_5">طیف پنج‌گزینه‌ای</option>
          <option value="numeric_scale">طیف عددی</option>
          <option value="single_choice">تک‌گزینه‌ای</option>
          <option value="multi_choice">چندگزینه‌ای</option>
          <option value="percentage">درصد</option>
          <option value="long_text">متن بلند</option>
          <option value="short_text">متن کوتاه</option>
          <option value="yes_no">بله/خیر</option>
        </Select></Field>
        <Field label="وزن" htmlFor="q-weight"><Input id="q-weight" type="number" dir="ltr" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        <Field label="دسته" htmlFor="q-cat"><Select id="q-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">بدون دسته</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select></Field>
      </div>

      {isChoice ? (
        <div className="space-y-2 rounded border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-700">گزینه‌ها (برچسب / مقدار / امتیاز ۰ تا ۱۰۰)</p>
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="برچسب" value={o.label} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <Input placeholder="مقدار" dir="ltr" value={o.value} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <Input placeholder="امتیاز" dir="ltr" type="number" value={o.score} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, score: e.target.value } : x)))} />
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={() => setOptions((prev) => [...prev, { label: '', value: '', score: '' }])}>افزودن گزینه</Button>
        </div>
      ) : null}

      <Button type="submit" disabled={busy}>{busy ? '…' : 'ایجاد پرسش'}</Button>
    </form>
  );
}

export function CycleForm({ formVersions }: { formVersions: { id: number; label: string }[] }) {
  const { message, busy, run } = useSubmit();
  const [name, setName] = useState('');
  const [formVersionId, setFormVersionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selfAssessment, setSelf] = useState(true);
  const [appealEnabled, setAppeal] = useState(true);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await apiClient('POST', '/evaluation-cycles', {
            name,
            formVersionId: Number(formVersionId),
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            selfAssessment,
            appealEnabled,
            confidentialityMode: 'named',
          });
          setName('');
        }, 'دوره ایجاد شد.');
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="نام دوره" htmlFor="c-name" required><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="نسخه فرم منتشرشده" htmlFor="c-fv" required><Select id="c-fv" value={formVersionId} onChange={(e) => setFormVersionId(e.target.value)} required>
        <option value="">انتخاب کنید…</option>
        {formVersions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </Select></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="تاریخ شروع (شمسی)" htmlFor="c-start" required>
          <JalaliDateInput id="c-start" value={startDate} onChange={setStartDate} required />
        </Field>
        <Field label="تاریخ پایان (شمسی)" htmlFor="c-end" required>
          <JalaliDateInput id="c-end" value={endDate} onChange={setEndDate} required />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selfAssessment} onChange={(e) => setSelf(e.target.checked)} /> فعال‌بودن خودارزیابی</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={appealEnabled} onChange={(e) => setAppeal(e.target.checked)} /> فعال‌بودن اعتراض</label>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ایجاد دوره'}</Button>
    </form>
  );
}

export function ActionButton({ method, path, body, label, variant = 'secondary', confirm }: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; body?: unknown; label: string; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; confirm?: string }) {
  const { busy, run } = useSubmit();
  return (
    <Button
      variant={variant}
      disabled={busy}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        void run(() => apiClient(method, path, body).then(() => undefined), 'انجام شد.');
      }}
    >
      {busy ? '…' : label}
    </Button>
  );
}

export function AiProviderForm() {
  const { message, busy, run } = useSubmit();
  const [name, setName] = useState('');
  const [type, setType] = useState('openai_compatible');
  const [baseUrl, setBaseUrl] = useState('https://api.gapgpt.app/v1');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const created = await apiClient<{ id: number }>('POST', '/ai/providers', { name, type, baseUrl, apiKey: apiKey || undefined, enabled: true, isDefault: true });
          if (modelId) await apiClient('POST', '/ai/models', { providerId: created.id, modelId, timeoutMs: 30000, streaming: true, enabled: true });
          setName('');
          setApiKey('');
          setModelId('');
        }, 'سرویس ذخیره شد. کلید فقط رمزنگاری‌شده نگهداری می‌شود.');
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Alert variant="info">آدرس پیشنهادی GapGPT درج شده است. پشتیبانی از نقاط پایانی/مدل‌ها باید بررسی شود؛ در صورت پشتیبانی‌نشدن، مدل را دستی وارد کنید.</Alert>
      <Field label="نام سرویس" htmlFor="ai-name" required><Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="نوع" htmlFor="ai-type"><Select id="ai-type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="openai_compatible">سازگار با OpenAI</option>
        <option value="google_gemini">Google Gemini</option>
        <option value="offline">محلی (بدون کلید)</option>
      </Select></Field>
      <Field label="آدرس پایه" htmlFor="ai-url"><Input id="ai-url" dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></Field>
      <Field label="کلید API" htmlFor="ai-key" hint="نوشتنی؛ هرگز نمایش داده نمی‌شود و رمزنگاری‌شده ذخیره می‌گردد."><Input id="ai-key" type="password" dir="ltr" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></Field>
      <Field label="شناسه مدل" htmlFor="ai-model"><Input id="ai-model" dir="ltr" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="مثلاً gpt-4o-mini" /></Field>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ذخیره سرویس'}</Button>
    </form>
  );
}

export function AiUseCaseToggle({ feature, enabled, dataCategories }: { feature: string; enabled: boolean; dataCategories: string[] }) {
  const { busy, run } = useSubmit();
  const [on, setOn] = useState(enabled);
  const [cats, setCats] = useState<string[]>(dataCategories.length ? dataCategories : ['help_content']);
  const all = ['help_content', 'own_results', 'aggregate_metrics', 'org_structure', 'policy_text'];

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> فعال‌بودن «{feature}»
      </label>
      <div className="flex flex-wrap gap-2">
        {all.map((c) => (
          <label key={c} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs">
            <input type="checkbox" checked={cats.includes(c)} onChange={(e) => setCats((prev) => (e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)))} />
            {c}
          </label>
        ))}
      </div>
      <Button variant="secondary" disabled={busy} onClick={() => void run(() => apiClient('PUT', '/ai/use-cases', { feature, enabled: on, dataCategories: cats }).then(() => undefined), 'ذخیره شد.')}>ذخیره سیاست کاربرد</Button>
    </div>
  );
}

export function ComplianceForm({ initial }: { initial: Record<string, unknown> }) {
  const { message, busy, run } = useSubmit();
  const [legalName, setLegalName] = useState(String(initial.legalName ?? ''));
  const [country, setCountry] = useState(String(initial.country ?? ''));
  const [contactEmail, setContactEmail] = useState(String(initial.contactEmail ?? ''));
  const [contactPhone, setContactPhone] = useState(String(initial.contactPhone ?? ''));
  const [registrationNo, setRegistrationNo] = useState(String(initial.registrationNo ?? ''));
  const [address, setAddress] = useState(String(initial.address ?? ''));
  const [jurisdictions, setJurisdictions] = useState(Array.isArray(initial.jurisdictions) ? (initial.jurisdictions as string[]).join(', ') : '');
  const [hasPaidOffering, setPaid] = useState(Boolean(initial.hasPaidOffering));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await apiClient('PUT', '/admin/compliance', {
            legalName: legalName || null,
            country: country || null,
            contactEmail: contactEmail || null,
            contactPhone: contactPhone || null,
            registrationNo: registrationNo || null,
            address: address || null,
            jurisdictions: jurisdictions.split(',').map((s) => s.trim()).filter(Boolean),
            hasPaidOffering,
          });
        }, 'اطلاعات انطباق ذخیره شد.');
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Alert variant="warning">فیلدهای خالی به‌عنوان «نیازمند تأیید کسب‌وکار» در اسناد حقوقی نمایش داده می‌شوند و جایگزین نمی‌شوند.</Alert>
      <Field label="نام حقوقی" htmlFor="co-legal"><Input id="co-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="کشور ثبت" htmlFor="co-country"><Input id="co-country" value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
        <Field label="شماره ثبت" htmlFor="co-reg"><Input id="co-reg" dir="ltr" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} /></Field>
        <Field label="ایمیل تماس" htmlFor="co-email"><Input id="co-email" dir="ltr" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
        <Field label="تلفن تماس" htmlFor="co-phone"><Input id="co-phone" dir="ltr" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
      </div>
      <Field label="نشانی" htmlFor="co-addr"><Input id="co-addr" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      <Field label="حوزه‌های قضایی" htmlFor="co-jur" hint="با کاما جدا کنید."><Input id="co-jur" value={jurisdictions} onChange={(e) => setJurisdictions(e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasPaidOffering} onChange={(e) => setPaid(e.target.checked)} /> سامانه دارای فروش/اشتراک پرداختی است</label>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ذخیره'}</Button>
    </form>
  );
}

const GENERAL_KEYS = ['platform_name', 'organization_display_name', 'default_theme'];
const PWA_KEYS = [
  'pwa_enabled',
  'pwa_name',
  'pwa_short_name',
  'pwa_description',
  'pwa_theme_color',
  'pwa_background_color',
  'pwa_display',
  'pwa_orientation',
  'pwa_install_prompt',
  'pwa_offline',
];

/**
 * Settings, split into independent sub-sections that each save on their own
 * (the API upserts only the keys it receives, so one section can never reset
 * another). A full-screen mode expands the panel for easier editing.
 */
export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const { message, busy, run } = useSubmit();
  const shellRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [v, setV] = useState<Record<string, string>>({
    platform_name: initial.platform_name ?? '',
    organization_display_name: initial.organization_display_name ?? '',
    default_theme: initial.default_theme ?? 'light',
    pwa_enabled: initial.pwa_enabled ?? 'true',
    pwa_name: initial.pwa_name ?? '',
    pwa_short_name: initial.pwa_short_name ?? '',
    pwa_description: initial.pwa_description ?? '',
    pwa_theme_color: initial.pwa_theme_color ?? '#1e3a8a',
    pwa_background_color: initial.pwa_background_color ?? '#f8fafc',
    pwa_display: initial.pwa_display ?? 'standalone',
    pwa_orientation: initial.pwa_orientation ?? 'portrait',
    pwa_install_prompt: initial.pwa_install_prompt ?? 'true',
    pwa_offline: initial.pwa_offline ?? 'true',
  });

  const set = (key: string, value: string) => setV((prev) => ({ ...prev, [key]: value }));

  async function toggleFull() {
    if (full) {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {
        /* the in-page overlay also works without the Fullscreen API */
      }
      setFull(false);
      return;
    }
    try {
      await shellRef.current?.requestFullscreen?.();
    } catch {
      /* permission denied — the fixed overlay below is the fallback */
    }
    setFull(true);
  }

  function save(keys: string[], okText: string) {
    void run(
      () => apiClient('PUT', '/admin/settings', Object.fromEntries(keys.map((k) => [k, v[k] ?? '']))).then(() => undefined),
      okText,
    );
  }

  const sectionClass = 'space-y-4 rounded border border-slate-200 p-4 dark:border-slate-800';
  const sectionTitleClass = 'text-sm font-semibold text-slate-800 dark:text-slate-100';

  return (
    <div ref={shellRef} className={`${full ? 'fixed inset-0 z-50 overflow-y-auto bg-canvas p-6 dark:bg-slate-950' : ''} space-y-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">هر زیربخش جداگانه ذخیره می‌شود؛ ذخیرهٔ یک بخش، بخش‌های دیگر را تغییر نمی‌دهد.</p>
        <Button variant="secondary" onClick={() => void toggleFull()}>
          {full ? 'خروج از حالت تمام‌صفحه' : 'نمایش تمام‌صفحه'}
        </Button>
      </div>

      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}

      <section className={sectionClass} aria-labelledby="settings-general">
        <h3 id="settings-general" className={sectionTitleClass}>۱) تنظیمات عمومی</h3>
        <Field label="نام سامانه" htmlFor="s-name" hint="در عنوان صفحه و مانیفست نصب‌شو استفاده می‌شود.">
          <Input id="s-name" value={v.platform_name ?? ''} onChange={(e) => set('platform_name', e.target.value)} />
        </Field>
        <Field label="نام نمایشی سازمان" htmlFor="s-org" hint="در نوار بالای سامانه نمایش داده می‌شود.">
          <Input id="s-org" value={v.organization_display_name ?? ''} onChange={(e) => set('organization_display_name', e.target.value)} />
        </Field>
        <Field label="پوسته پیش‌فرض" htmlFor="s-theme" hint="کاربر می‌تواند از نوار بالا آن را تغییر دهد.">
          <Select id="s-theme" value={v.default_theme ?? 'light'} onChange={(e) => set('default_theme', e.target.value)}>
            <option value="light">روشن</option>
            <option value="dark">تیره</option>
          </Select>
        </Field>
        <Button disabled={busy} onClick={() => save(GENERAL_KEYS, 'تنظیمات عمومی ذخیره شد.')}>ذخیره بخش عمومی</Button>
      </section>

      <section className={sectionClass} aria-labelledby="settings-pwa">
        <h3 id="settings-pwa" className={sectionTitleClass}>۲) اپلیکیشن نصب‌شو (PWA)</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.pwa_enabled !== 'false'} onChange={(e) => set('pwa_enabled', String(e.target.checked))} /> فعال‌بودن نسخه نصب‌شو
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام برنامه" htmlFor="pwa-name"><Input id="pwa-name" value={v.pwa_name ?? ''} onChange={(e) => set('pwa_name', e.target.value)} /></Field>
          <Field label="نام کوتاه" htmlFor="pwa-short"><Input id="pwa-short" value={v.pwa_short_name ?? ''} onChange={(e) => set('pwa_short_name', e.target.value)} /></Field>
        </div>
        <Field label="توضیح" htmlFor="pwa-desc"><Input id="pwa-desc" value={v.pwa_description ?? ''} onChange={(e) => set('pwa_description', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رنگ اصلی" htmlFor="pwa-theme"><Input id="pwa-theme" dir="ltr" value={v.pwa_theme_color ?? ''} onChange={(e) => set('pwa_theme_color', e.target.value)} /></Field>
          <Field label="رنگ پس‌زمینه" htmlFor="pwa-bg"><Input id="pwa-bg" dir="ltr" value={v.pwa_background_color ?? ''} onChange={(e) => set('pwa_background_color', e.target.value)} /></Field>
          <Field label="حالت نمایش" htmlFor="pwa-display">
            <Select id="pwa-display" value={v.pwa_display ?? 'standalone'} onChange={(e) => set('pwa_display', e.target.value)}>
              <option value="standalone">standalone</option>
              <option value="fullscreen">fullscreen</option>
              <option value="minimal-ui">minimal-ui</option>
              <option value="browser">browser</option>
            </Select>
          </Field>
          <Field label="جهت" htmlFor="pwa-orient">
            <Select id="pwa-orient" value={v.pwa_orientation ?? 'portrait'} onChange={(e) => set('pwa_orientation', e.target.value)}>
              <option value="portrait">portrait</option>
              <option value="landscape">landscape</option>
              <option value="any">any</option>
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.pwa_install_prompt !== 'false'} onChange={(e) => set('pwa_install_prompt', String(e.target.checked))} /> نمایش پیام نصب
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.pwa_offline !== 'false'} onChange={(e) => set('pwa_offline', String(e.target.checked))} /> پشتیبانی آفلاین (سرویس‌ورکر)
        </label>
        <Button disabled={busy} onClick={() => save(PWA_KEYS, 'تنظیمات PWA ذخیره شد.')}>ذخیره بخش PWA</Button>
      </section>
    </div>
  );
}

export function FormCreateForm() {
  const { message, busy, run } = useSubmit();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await apiClient('POST', '/forms', { name, description: description || undefined });
          setName('');
          setDescription('');
        }, 'فرم ایجاد شد.');
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="نام فرم" htmlFor="f-name" required><Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="توضیح" htmlFor="f-desc"><Input id="f-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ایجاد فرم'}</Button>
    </form>
  );
}
