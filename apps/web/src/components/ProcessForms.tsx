'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Select, Textarea, Alert, Badge } from '@/components/ui';

interface Step { id: number; name: string; order: number; ownerType: string; ownerRoleKey: string | null; slaDays: number | null }
interface Dimension { id: number; name: string; weight: string; ownerRoleKey: string | null }
interface Proc { id: number; name: string; evaluationModel: string; status: string; version: number; targetGroups: unknown; steps: Step[]; dimensions: Dimension[]; _count: { cycles: number } }

const MODEL_LABELS: Record<string, string> = {
  weighted_360: 'ارزیابی ۳۶۰ درجه وزن‌دار',
  manager_only: 'فقط مدیر',
  self_and_manager: 'خودارزیابی و مدیر',
  management_by_objectives: 'مدیریت بر مبنای اهداف (MBO)',
};

export function ProcessForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [evaluationModel, setModel] = useState('weighted_360');
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
          await apiClient('POST', '/processes', { name, description: description || undefined, evaluationModel, targetGroups: [], status: 'draft' });
          setMessage({ type: 'success', text: 'فرایند ایجاد شد.' });
          setName('');
          setDescription('');
          router.refresh();
        } catch (err) {
          setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ایجاد فرایند.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="نام فرایند" htmlFor="pf-name" required><Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="توضیح" htmlFor="pf-desc"><Textarea id="pf-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="مدل ارزیابی" htmlFor="pf-model">
        <Select id="pf-model" value={evaluationModel} onChange={(e) => setModel(e.target.value)}>
          {Object.entries(MODEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ایجاد فرایند'}</Button>
      <p className="text-xs text-slate-500">پس از ایجاد، مراحل و ابعاد را اضافه کنید و افراد مسئول هرکدام را تعیین کنید.</p>
    </form>
  );
}

export function ProcessRow({ process }: { process: Proc }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [stepName, setStepName] = useState('');
  const [stepSla, setStepSla] = useState('');
  const [stepOwner, setStepOwner] = useState('hr_manager');
  const [dimName, setDimName] = useState('');
  const [dimWeight, setDimWeight] = useState('50');
  const [dimOwner, setDimOwner] = useState('manager');

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

  return (
    <div className="border-t border-slate-100 p-5 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {process.name} <span className="text-xs text-slate-400">v{process.version}</span>
          </p>
          <p className="text-xs text-slate-500">{MODEL_LABELS[process.evaluationModel] ?? process.evaluationModel} • {process._count.cycles} دوره</p>
        </div>
        <Badge tone={process.status === 'active' ? 'success' : process.status === 'archived' ? 'muted' : 'warning'}>
          {process.status === 'active' ? 'فعال' : process.status === 'archived' ? 'بایگانی' : 'پیش‌نویس'}
        </Badge>
      </div>

      {note ? <div className="mt-2"><Alert variant="info">{note}</Alert></div> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">مراحل عملیاتی</p>
          <ul className="mb-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {process.steps.length === 0 ? <li className="text-slate-400">مرحله‌ای ثبت نشده است.</li> : null}
            {process.steps.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
                <span>{s.order}. {s.name} — مسئول: {s.ownerRoleKey ?? s.ownerType}{s.slaDays != null ? ` (${s.slaDays} روز)` : ''}</span>
                <button className="text-rose-600" disabled={busy} onClick={() => void run(() => apiClient('DELETE', `/processes/steps/${s.id}`))}>حذف</button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <Input aria-label="نام مرحله" placeholder="نام مرحله" value={stepName} onChange={(e) => setStepName(e.target.value)} />
            <Select aria-label="مسئول" value={stepOwner} onChange={(e) => setStepOwner(e.target.value)}>
              <option value="hr_manager">منابع انسانی</option><option value="department_manager">مدیر مستقیم</option><option value="employee">کارمند</option><option value="system_admin">مدیر سامانه</option>
            </Select>
            <Input aria-label="مهلت روز" className="w-24" dir="ltr" type="number" placeholder="روز" value={stepSla} onChange={(e) => setStepSla(e.target.value)} />
            <Button variant="secondary" disabled={busy || stepName.trim().length < 2} onClick={() => void run(() => apiClient('POST', `/processes/${process.id}/steps`, { name: stepName, order: process.steps.length, ownerType: 'role', ownerRoleKey: stepOwner, slaDays: stepSla ? Number(stepSla) : null }), 'مرحله افزوده شد.').then(() => setStepName(''))}>
              <Plus aria-hidden className="h-4 w-4" /> مرحله
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">ابعاد ارزیابی</p>
          <ul className="mb-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {process.dimensions.length === 0 ? <li className="text-slate-400">بعدی ثبت نشده است.</li> : null}
            {process.dimensions.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
                <span>{d.name} — وزن {d.weight} — مسئول: {d.ownerRoleKey ?? '—'}</span>
                <button className="text-rose-600" disabled={busy} onClick={() => void run(() => apiClient('DELETE', `/processes/dimensions/${d.id}`))}>حذف</button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <Input aria-label="نام بعد" placeholder="نام بعد" value={dimName} onChange={(e) => setDimName(e.target.value)} />
            <Input aria-label="وزن" className="w-20" dir="ltr" type="number" value={dimWeight} onChange={(e) => setDimWeight(e.target.value)} />
            <Select aria-label="مسئول" value={dimOwner} onChange={(e) => setDimOwner(e.target.value)}>
              <option value="manager">مدیر مستقیم</option><option value="hr_manager">منابع انسانی</option><option value="employee">کارمند</option>
            </Select>
            <Button variant="secondary" disabled={busy || dimName.trim().length < 2} onClick={() => void run(() => apiClient('POST', `/processes/${process.id}/dimensions`, { name: dimName, weight: Number(dimWeight) || 0, ownerRoleKey: dimOwner, sortOrder: process.dimensions.length }), 'بعد افزوده شد.').then(() => setDimName(''))}>
              <Plus aria-hidden className="h-4 w-4" /> بعد
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void run(() => apiClient('PATCH', `/processes/${process.id}`, { status: 'active' }), 'فرایند فعال شد.')}>فعال‌سازی</Button>
        <Button variant="danger" disabled={busy} onClick={() => void run(() => apiClient('POST', `/processes/${process.id}/archive`), 'بایگانی شد.')}>بایگانی</Button>
      </div>
    </div>
  );
}
