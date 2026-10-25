'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Select, Alert, Card, CardBody } from '@/components/ui';
import { JalaliDateInput } from '@/components/JalaliDateInput';
import { cn } from '@pe/ui';

interface Version { id: number; label: string }
interface Employee { id: number; label: string }

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border', i < current ? 'border-brand-600 bg-brand-600 text-white' : i === current ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-400 dark:border-slate-700')}>
            {i < current ? <Check aria-hidden className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn(i === current ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500')}>{label}</span>
          {i < steps.length - 1 ? <ChevronLeft aria-hidden className="h-4 w-4 text-slate-300" /> : null}
        </li>
      ))}
    </ol>
  );
}

const ROLES = [
  { key: 'self', label: 'خودارزیابی' },
  { key: 'manager', label: 'مدیر مستقیم' },
  { key: 'hr', label: 'منابع انسانی' },
];

export function CycleWizard({ versions, employees }: { versions: Version[]; employees: Employee[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const steps = ['اطلاعات دوره', 'ارزیابان', 'ایجاد و فعال‌سازی'];

  const [name, setName] = useState('');
  const [formVersionId, setFormVersionId] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selfAssessment, setSelfAssessment] = useState(true);
  const [appealEnabled, setAppealEnabled] = useState(true);

  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [roles, setRoles] = useState<string[]>(['manager', 'self']);
  const [weights, setWeights] = useState<Record<string, string>>({ manager: '70', self: '30', hr: '0' });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ created: number } | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در انجام عملیات.');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (step === 0) {
      if (name.trim().length < 2) return setError('نام دوره را وارد کنید.');
      if (!formVersionId) return setError('نسخه فرم را انتخاب کنید.');
      if (!startDate || !endDate) return setError('تاریخ شروع و پایان را انتخاب کنید.');
      setStep(1);
      return;
    }
    if (step === 1) {
      if (employeeIds.length === 0) return setError('حداقل یک کارمند انتخاب کنید.');
      if (roles.length === 0) return setError('حداقل یک نقش ارزیاب انتخاب کنید.');
      setStep(2);
      return;
    }
    await run(async () => {
      const cycle = await apiClient<{ id: number }>('POST', '/evaluation-cycles', {
        name,
        formVersionId: Number(formVersionId),
        startDate: new Date(startDate as string).toISOString(),
        endDate: new Date(endDate as string).toISOString(),
        selfAssessment,
        appealEnabled,
        confidentialityMode: 'named',
        publicationRule: 'manual',
      });
      await apiClient('POST', `/evaluation-cycles/${cycle.id}/status`, { status: 'active' });
      const assign = await apiClient<{ created: number }>('POST', `/evaluation-cycles/${cycle.id}/assignments`, {
        employeeIds,
        evaluatorRoles: roles,
        strategy: 'current_manager',
        weights: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, Number(v) || 0])),
      });
      setResult({ created: assign.created });
      setDone(true);
      router.refresh();
    }).catch(() => undefined);
  }

  if (done) {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">دوره ایجاد، فعال و ارجاع شد</p>
          <p className="text-sm text-slate-500">{result?.created ?? 0} ارزیابی ساخته شد.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => router.push('/admin/cycles')}>مشاهده دوره‌ها</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>ساخت دوره جدید</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div>
      <Stepper steps={steps} current={step} />
      {error ? <div className="mb-4"><Alert variant="danger">{error}</Alert></div> : null}

      {step === 0 ? (
        <div className="space-y-4">
          {versions.length === 0 ? <Alert variant="warning">ابتدا یک فرم را منتشر کنید (از ویزارد فرم).</Alert> : null}
          <Field label="نام دوره" htmlFor="cw-name" required><Input id="cw-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="نسخه فرم منتشرشده" htmlFor="cw-fv" required>
            <Select id="cw-fv" value={formVersionId} onChange={(e) => setFormVersionId(e.target.value)}>
              <option value="">انتخاب کنید…</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="تاریخ شروع (شمسی)" htmlFor="cw-s" required><JalaliDateInput id="cw-s" value={startDate} onChange={setStartDate} required /></Field>
            <Field label="تاریخ پایان (شمسی)" htmlFor="cw-e" required><JalaliDateInput id="cw-e" value={endDate} onChange={setEndDate} required /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selfAssessment} onChange={(e) => setSelfAssessment(e.target.checked)} /> فعال‌بودن خودارزیابی</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={appealEnabled} onChange={(e) => setAppealEnabled(e.target.checked)} /> فعال‌بودن اعتراض</label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">نقش‌های ارزیاب و وزن</p>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <div key={r.key} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={roles.includes(r.key)} onChange={(e) => setRoles((prev) => (e.target.checked ? [...prev, r.key] : prev.filter((x) => x !== r.key)))} />
                    {r.label}
                  </label>
                  <Input aria-label={`وزن ${r.label}`} dir="ltr" type="number" className="w-24" value={weights[r.key] ?? ''} onChange={(e) => setWeights((prev) => ({ ...prev, [r.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">کارکنان ({employeeIds.length} انتخاب‌شده)</p>
            <div className="max-h-64 overflow-y-auto rounded border border-slate-200 p-3 dark:border-slate-700">
              <label className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={employeeIds.length === employees.length && employees.length > 0} onChange={(e) => setEmployeeIds(e.target.checked ? employees.map((x) => x.id) : [])} /> انتخاب همه
              </label>
              <div className="grid gap-1 sm:grid-cols-2">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" className="mt-0.5" checked={employeeIds.includes(emp.id)} onChange={(e) => setEmployeeIds((prev) => (e.target.checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id)))} />
                    <span>{emp.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>دوره «{name}» با {employeeIds.length} کارمند و نقش‌های {roles.map((r) => ROLES.find((x) => x.key === r)?.label ?? r).join('، ')} ساخته می‌شود.</p>
          <p>پس از ایجاد، دوره «فعال» شده و ارزیابی‌ها ارجاع داده می‌شوند.</p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={busy || step === 0}>
          <ChevronRight aria-hidden className="h-4 w-4" /> مرحله قبل
        </Button>
        <Button onClick={next} disabled={busy}>
          {busy ? 'در حال انجام…' : step === 2 ? 'ایجاد و فعال‌سازی دوره' : 'مرحله بعد'} <ChevronLeft aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
