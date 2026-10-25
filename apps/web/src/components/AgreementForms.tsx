'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Select, Textarea, Alert, Badge } from '@/components/ui';
import { formatJalali } from '@/lib/format';

export interface Indicator { id: number; name: string; unit: string | null; targetValue: string | null; actualValue: string | null; weight: string; progress: number }
export interface Entry { id: number; type: string; body: string; createdAt: string }
export interface Agreement {
  id: number;
  title: string;
  status: string;
  employee: { firstName: string; lastName: string; employeeNo: string };
  indicators: Indicator[];
  entries: Entry[];
}

interface DraftIndicator { name: string; unit: string; targetValue: string; weight: string }

export function AgreementForm({ employees, cycles }: { employees: { id: number; label: string }[]; cycles: { id: number; name: string }[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('active');
  const [indicators, setIndicators] = useState<DraftIndicator[]>([{ name: '', unit: '', targetValue: '', weight: '1' }]);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          await apiClient('POST', '/agreements', {
            employeeId: Number(employeeId),
            cycleId: cycleId ? Number(cycleId) : null,
            title,
            status,
            indicators: indicators
              .filter((i) => i.name.trim())
              .map((i, index) => ({
                name: i.name,
                unit: i.unit || undefined,
                targetValue: i.targetValue ? Number(i.targetValue) : null,
                weight: Number(i.weight) || 1,
                progress: 0,
                sortOrder: index,
              })),
          });
          setMessage({ type: 'success', text: 'توافق‌نامه ثبت شد.' });
          setTitle('');
          setIndicators([{ name: '', unit: '', targetValue: '', weight: '1' }]);
          router.refresh();
        } catch (err) {
          setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ثبت.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="کارمند" htmlFor="ag-emp" required>
        <Select id="ag-emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          <option value="">انتخاب کنید…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </Select>
      </Field>
      <Field label="دوره (اختیاری)" htmlFor="ag-cycle">
        <Select id="ag-cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
          <option value="">بدون دوره</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="عنوان توافق‌نامه" htmlFor="ag-title" required><Input id="ag-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>

      <div className="space-y-2 rounded border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">شاخص‌ها و نتایج کلیدی</p>
        {indicators.map((ind, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input aria-label="نام شاخص" placeholder="شاخص" value={ind.name} onChange={(e) => setIndicators((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input aria-label="انتظار" placeholder="انتظار/هدف" value={ind.targetValue} onChange={(e) => setIndicators((prev) => prev.map((x, j) => (j === i ? { ...x, targetValue: e.target.value } : x)))} />
            <Input aria-label="واحد" className="w-24" placeholder="واحد" value={ind.unit} onChange={(e) => setIndicators((prev) => prev.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
            <Input aria-label="وزن" className="w-20" dir="ltr" type="number" value={ind.weight} onChange={(e) => setIndicators((prev) => prev.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
            {indicators.length > 1 ? (
              <button type="button" className="text-rose-600" onClick={() => setIndicators((prev) => prev.filter((_, j) => j !== i))}><Trash2 aria-hidden className="h-4 w-4" /></button>
            ) : null}
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setIndicators((prev) => [...prev, { name: '', unit: '', targetValue: '', weight: '1' }])}><Plus aria-hidden className="h-4 w-4" /> افزودن شاخص</Button>
      </div>

      <Field label="وضعیت" htmlFor="ag-status">
        <Select id="ag-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">در جریان</option><option value="draft">پیش‌نویس</option><option value="completed">تکمیل‌شده</option><option value="cancelled">لغو‌شده</option>
        </Select>
      </Field>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ثبت توافق‌نامه'}</Button>
    </form>
  );
}

export function AgreementCard({ agreement, canManage }: { agreement: Agreement; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [entryBody, setEntryBody] = useState('');
  const [entryType, setEntryType] = useState('feedback');

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      if (ok) setNote(ok);
      router.refresh();
    } catch (err) {
      setNote(err instanceof ApiClientError ? err.message : 'خطا.');
    } finally {
      setBusy(false);
    }
  }

  const avgProgress = agreement.indicators.length
    ? Math.round(agreement.indicators.reduce((sum, i) => sum + i.progress, 0) / agreement.indicators.length)
    : 0;

  return (
    <div className="border-t border-slate-100 p-5 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-800 dark:text-slate-100">
          {agreement.title} — {agreement.employee.firstName} {agreement.employee.lastName}
        </p>
        <div className="flex items-center gap-2">
          <Badge tone={agreement.status === 'completed' ? 'success' : agreement.status === 'active' ? 'info' : 'muted'}>
            {agreement.status === 'completed' ? 'تکمیل‌شده' : agreement.status === 'active' ? 'در جریان' : agreement.status === 'cancelled' ? 'لغو‌شده' : 'پیش‌نویس'}
          </Badge>
          <Badge tone="muted">پیشرفت {avgProgress}٪</Badge>
        </div>
      </div>

      {note ? <div className="mt-2"><Alert variant="info">{note}</Alert></div> : null}

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">شاخص‌ها و پیشرفت</p>
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {agreement.indicators.map((ind) => (
              <li key={ind.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
                <span className="flex-1">{ind.name}{ind.unit ? ` (${ind.unit})` : ''} — هدف: {ind.targetValue ?? '—'}</span>
                {canManage ? (
                  <>
                    <Input aria-label="مقدار واقعی" className="w-24" dir="ltr" type="number" defaultValue={ind.actualValue ?? ''} onBlur={(e) => void run(() => apiClient('PATCH', `/agreements/indicators/${ind.id}`, { actualValue: e.target.value ? Number(e.target.value) : null }))} />
                    <Input aria-label="پیشرفت" className="w-20" dir="ltr" type="number" min={0} max={100} defaultValue={ind.progress} onBlur={(e) => void run(() => apiClient('PATCH', `/agreements/indicators/${ind.id}`, { progress: Number(e.target.value) || 0 }))} />
                    <span>%</span>
                  </>
                ) : (
                  <span>{ind.progress}٪</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">رخدادها و بازخورد</p>
          <ul className="mb-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {agreement.entries.length === 0 ? <li className="text-slate-400">موردی ثبت نشده است.</li> : null}
            {agreement.entries.map((en) => (
              <li key={en.id} className="rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
                <span className="text-slate-400">{formatJalali(en.createdAt)} • {en.type === 'event' ? 'رخداد' : en.type === 'progress' ? 'پیشرفت' : 'بازخورد'}:</span> {en.body}
              </li>
            ))}
          </ul>
          {canManage ? (
            <div className="flex flex-wrap items-end gap-2">
              <Select aria-label="نوع" value={entryType} onChange={(e) => setEntryType(e.target.value)}>
                <option value="feedback">بازخورد</option><option value="event">رخداد</option><option value="progress">پیشرفت</option>
              </Select>
              <Textarea aria-label="متن" value={entryBody} onChange={(e) => setEntryBody(e.target.value)} />
              <Button variant="secondary" disabled={busy || entryBody.trim().length === 0} onClick={() => void run(() => apiClient('POST', `/agreements/${agreement.id}/entries`, { type: entryType, body: entryBody }), 'ثبت شد.').then(() => setEntryBody(''))}>ثبت</Button>
            </div>
          ) : null}
        </div>
      </div>

      {canManage && agreement.status !== 'completed' ? (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void run(() => apiClient('PATCH', `/agreements/${agreement.id}`, { status: 'completed' }), 'تکمیل شد.')}>تکمیل</Button>
          <Button variant="danger" disabled={busy} onClick={() => void run(() => apiClient('DELETE', `/agreements/${agreement.id}`), 'حذف شد.')}>حذف</Button>
        </div>
      ) : null}
    </div>
  );
}
