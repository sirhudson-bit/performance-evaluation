'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, ChevronLeft, Plus, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@pe/ui';
import { apiClient, ApiClientError } from '@/lib/client';
import { Alert, Button, Field, Input, Select, Textarea, Badge } from '@/components/ui';
import { faDigits } from '@/lib/format';
import {
  MODEL_LABELS,
  OWNER_OPTIONS,
  PROCESS_PRESETS,
  sumWeights,
  type DimensionDraft,
  type StepDraft,
} from '@/components/processPresets';

interface Unit { id: number; name: string; code: string | null }
interface Role { key: string; name: string }

const STEP_TITLES = ['اطلاعات پایه', 'مراحل اجرا', 'ابعاد ارزیابی', 'بازبینی و ثبت'];

let counter = 0;
const nextKey = () => `k${++counter}`;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs" aria-label="مراحل ساخت فرایند">
      {STEP_TITLES.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border',
              i < current
                ? 'border-brand-600 bg-brand-600 text-white'
                : i === current
                  ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                  : 'border-slate-300 text-slate-400 dark:border-slate-700',
            )}
          >
            {i < current ? <Check aria-hidden className="h-4 w-4" /> : faDigits(i + 1)}
          </span>
          <span className={cn(i === current ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500')}>{label}</span>
          {i < STEP_TITLES.length - 1 ? <ChevronLeft aria-hidden className="h-4 w-4 text-slate-300" /> : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The process builder. Four small steps instead of one dense form: the operator
 * always sees what they are filling and can jump back without losing anything —
 * the draft lives in component state until the final «ثبت» sends process, steps
 * and dimensions in a single request.
 */
export function ProcessWizard({ units, roles }: { units: Unit[]; roles: Role[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [evaluationModel, setModel] = useState('weighted_360');
  const [targetUnits, setTargetUnits] = useState<number[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [dimensions, setDimensions] = useState<DimensionDraft[]>([]);
  const [activate, setActivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = sumWeights(dimensions);

  function applyPreset(id: string) {
    const preset = PROCESS_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setModel(preset.evaluationModel);
    setSteps(preset.steps.map((s) => ({ ...s, key: nextKey() })));
    setDimensions(preset.dimensions.map((d) => ({ ...d, key: nextKey() })));
    setError(null);
  }

  function addStep() {
    setSteps((prev) => [...prev, { key: nextKey(), name: '', ownerRoleKey: 'department_manager', slaDays: '7' }]);
  }
  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function removeStep(key: string) {
    setSteps((prev) => prev.filter((s) => s.key !== key));
  }
  function moveStep(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }

  function addDimension() {
    setDimensions((prev) => [...prev, { key: nextKey(), name: '', weight: '25', ownerRoleKey: 'department_manager' }]);
  }
  function updateDimension(key: string, patch: Partial<DimensionDraft>) {
    setDimensions((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function removeDimension(key: string) {
    setDimensions((prev) => prev.filter((d) => d.key !== key));
  }
  function moveDimension(index: number, dir: -1 | 1) {
    setDimensions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }

  function goNext() {
    setError(null);
    if (step === 0) {
      if (name.trim().length < 2) return setError('نام فرایند را وارد کنید (حداقل ۲ حرف).');
      setStep(1);
      return;
    }
    if (step === 1) {
      if (steps.length === 0) return setError('حداقل یک مرحله اضافه کنید.');
      if (steps.some((s) => s.name.trim().length < 2)) return setError('نام همه مراحل باید حداقل ۲ حرف باشد.');
      setStep(2);
      return;
    }
    if (step === 2) {
      if (dimensions.some((d) => d.name.trim().length < 2)) return setError('نام همه ابعاد باید حداقل ۲ حرف باشد.');
      setStep(3);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const targetGroups = [
        ...targetUnits.map((id) => ({ type: 'unit' as const, id })),
        ...targetRoles.map((key) => ({ type: 'role' as const, key })),
      ];
      const created = await apiClient<{ id: number }>('POST', '/processes', {
        name: name.trim(),
        description: description.trim() || undefined,
        evaluationModel,
        targetGroups,
        status: activate ? 'active' : 'draft',
        steps: steps.map((s, index) => ({
          name: s.name.trim(),
          order: index,
          ownerType: 'role',
          ownerRoleKey: s.ownerRoleKey,
          slaDays: s.slaDays ? Number(s.slaDays) : null,
        })),
        dimensions: dimensions.map((d, index) => ({
          name: d.name.trim(),
          weight: Number(d.weight) || 0,
          ownerRoleKey: d.ownerRoleKey,
          sortOrder: index,
        })),
      });
      router.push(`/admin/processes/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در ثبت فرایند.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Stepper current={step} />
      {error ? <div className="mb-4"><Alert variant="danger">{error}</Alert></div> : null}

      {step === 0 ? (
        <div className="space-y-4">
          <Field label="نام فرایند" htmlFor="pw-name" required>
            <Input id="pw-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً ارزیابی عملکرد سالانه" />
          </Field>
          <Field label="توضیح" htmlFor="pw-desc" hint="اختیاری — هدف فرایند و دامنه آن را بنویسید.">
            <Textarea id="pw-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="مدل ارزیابی" htmlFor="pw-model">
            <Select id="pw-model" value={evaluationModel} onChange={(e) => setModel(e.target.value)}>
              {Object.entries(MODEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">شروع سریع با الگوی آماده</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PROCESS_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="rounded border border-slate-200 p-3 text-right text-xs transition hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <span className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-100">
                    <Sparkles aria-hidden className="h-3.5 w-3.5 text-brand-600" /> {p.title}
                  </span>
                  <span className="mt-1 block text-slate-500">{p.description}</span>
                  <span className="mt-1 block text-slate-400">
                    {faDigits(p.steps.length)} مرحله • {faDigits(p.dimensions.length)} بعد
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">گروه‌های هدف (واحد)</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
                {units.length === 0 ? <p className="text-xs text-slate-400">واحدی ثبت نشده است.</p> : null}
                {units.map((u) => (
                  <label key={u.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={targetUnits.includes(u.id)}
                      onChange={(e) =>
                        setTargetUnits((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))
                      }
                    />
                    <span>{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">گروه‌های هدف (نقش)</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
                {roles.map((r) => (
                  <label key={r.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={targetRoles.includes(r.key)}
                      onChange={(e) =>
                        setTargetRoles((prev) => (e.target.checked ? [...prev, r.key] : prev.filter((k) => k !== r.key)))
                      }
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ترتیب مراحل همان ترتیب اجرای فرایند است؛ هر مرحله یک مسئول و یک مهلت دارد.
          </p>
          {steps.length === 0 ? <Alert variant="info">هنوز مرحله‌ای اضافه نشده است.</Alert> : null}
          {steps.map((s, index) => (
            <div key={s.key} className="grid gap-2 rounded border border-slate-200 p-3 sm:grid-cols-[auto_1fr_auto_auto_auto] dark:border-slate-700">
              <span className="self-center text-xs font-medium text-slate-400">{faDigits(index + 1)}</span>
              <Input
                aria-label={`نام مرحله ${index + 1}`}
                placeholder="نام مرحله"
                value={s.name}
                onChange={(e) => updateStep(s.key, { name: e.target.value })}
              />
              <Select aria-label="مسئول مرحله" value={s.ownerRoleKey} onChange={(e) => updateStep(s.key, { ownerRoleKey: e.target.value })}>
                {OWNER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </Select>
              <Input
                aria-label="مهلت (روز)"
                dir="ltr"
                type="number"
                min={0}
                className="w-24"
                placeholder="روز"
                value={s.slaDays}
                onChange={(e) => updateStep(s.key, { slaDays: e.target.value })}
              />
              <div className="flex items-center gap-1">
                <button type="button" aria-label="بالا" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => moveStep(index, -1)}>▲</button>
                <button type="button" aria-label="پایین" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => moveStep(index, 1)}>▼</button>
                <button type="button" aria-label="حذف مرحله" className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" onClick={() => removeStep(s.key)}>
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addStep}>
            <Plus aria-hidden className="h-4 w-4" /> افزودن مرحله
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ابعاد، محورهای امتیازدهی‌اند. مجموع وزن‌ها بهتر است ۱۰۰ باشد.
          </p>
          {dimensions.length === 0 ? <Alert variant="info">هنوز بعدی اضافه نشده است؛ بعدها اختیاری‌اند اما امتیازدهی را شفاف می‌کنند.</Alert> : null}
          {dimensions.map((d, index) => (
            <div key={d.key} className="grid gap-2 rounded border border-slate-200 p-3 sm:grid-cols-[auto_1fr_auto_auto_auto] dark:border-slate-700">
              <span className="self-center text-xs font-medium text-slate-400">{faDigits(index + 1)}</span>
              <Input
                aria-label={`نام بعد ${index + 1}`}
                placeholder="نام بعد (مثلاً کیفیت کار)"
                value={d.name}
                onChange={(e) => updateDimension(d.key, { name: e.target.value })}
              />
              <Input
                aria-label="وزن بعد"
                dir="ltr"
                type="number"
                min={0}
                className="w-24"
                value={d.weight}
                onChange={(e) => updateDimension(d.key, { weight: e.target.value })}
              />
              <Select aria-label="مسئول بعد" value={d.ownerRoleKey} onChange={(e) => updateDimension(d.key, { ownerRoleKey: e.target.value })}>
                {OWNER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </Select>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="بالا" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => moveDimension(index, -1)}>▲</button>
                <button type="button" aria-label="پایین" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => moveDimension(index, 1)}>▼</button>
                <button type="button" aria-label="حذف بعد" className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" onClick={() => removeDimension(d.key)}>
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={addDimension}>
              <Plus aria-hidden className="h-4 w-4" /> افزودن بعد
            </Button>
            <Badge tone={total === 100 ? 'success' : 'warning'}>مجموع وزن‌ها: {faDigits(total)}٪</Badge>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-slate-200 p-4 text-sm dark:border-slate-700">
              <p className="font-medium text-slate-800 dark:text-slate-100">{name || '—'}</p>
              <p className="mt-1 text-xs text-slate-500">{MODEL_LABELS[evaluationModel]}</p>
              {description ? <p className="mt-2 text-xs text-slate-500">{description}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                گروه هدف: {faDigits(targetUnits.length + targetRoles.length)} مورد
              </p>
            </div>
            <div className="rounded border border-slate-200 p-4 text-sm dark:border-slate-700">
              <p className="text-xs text-slate-500">مراحل</p>
              <ol className="mt-1 space-y-0.5 text-xs">
                {steps.map((s, i) => (
                  <li key={s.key}>
                    {faDigits(i + 1)}. {s.name} — {OWNER_OPTIONS.find((o) => o.key === s.ownerRoleKey)?.label ?? s.ownerRoleKey}
                    {s.slaDays ? ` (${faDigits(Number(s.slaDays))} روز)` : ''}
                  </li>
                ))}
                {steps.length === 0 ? <li className="text-slate-400">—</li> : null}
              </ol>
              <p className="mt-3 text-xs text-slate-500">ابعاد</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {dimensions.map((d) => (
                  <li key={d.key}>{d.name} — وزن {faDigits(Number(d.weight) || 0)}</li>
                ))}
                {dimensions.length === 0 ? <li className="text-slate-400">—</li> : null}
              </ul>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
            فرایند پس از ثبت فعال شود
          </label>

          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? 'در حال ثبت…' : 'ثبت فرایند'}
          </Button>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button type="button" variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowRight aria-hidden className="h-4 w-4" /> قبلی
        </Button>
        {step < 3 ? (
          <Button type="button" disabled={busy} onClick={goNext}>
            بعدی <ArrowLeft aria-hidden className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
