'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Save, Power, Archive, ExternalLink } from 'lucide-react';
import { apiClient, ApiClientError } from '@/lib/client';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from '@/components/ui';
import { faDigits } from '@/lib/format';
import { MODEL_LABELS, OWNER_OPTIONS, STATUS_LABELS, sumWeights } from '@/components/processPresets';

interface TargetGroup { type: 'unit' | 'role' | 'employee'; id?: number; key?: string }
interface Step { id: number; name: string; order: number; ownerType: string; ownerRoleKey: string | null; slaDays: number | null }
interface Dimension { id: number; name: string; weight: string; ownerRoleKey: string | null; sortOrder: number }
interface Proc {
  id: number;
  name: string;
  description: string | null;
  evaluationModel: string;
  status: string;
  version: number;
  targetGroups: TargetGroup[];
  steps: Step[];
  dimensions: Dimension[];
  _count: { cycles: number };
}
interface Unit { id: number; name: string }
interface Role { key: string; name: string }

/**
 * Everything about one process in a single page, grouped the way the operator
 * thinks: identity → steps → dimensions → target groups → status. Each row saves
 * on its own so a small edit never re-submits the whole process.
 */
export function ProcessEditor({ process, units, roles }: { process: Proc; units: Unit[]; roles: Role[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  const [name, setName] = useState(process.name);
  const [description, setDescription] = useState(process.description ?? '');
  const [evaluationModel, setModel] = useState(process.evaluationModel);

  const initialUnits = process.targetGroups.filter((g) => g.type === 'unit' && g.id).map((g) => g.id as number);
  const initialRoles = process.targetGroups.filter((g) => g.type === 'role' && g.key).map((g) => g.key as string);
  const [targetUnits, setTargetUnits] = useState<number[]>(initialUnits);
  const [targetRoles, setTargetRoles] = useState<string[]>(initialRoles);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      if (ok) setNote({ type: 'success', text: ok });
      router.refresh();
    } catch (err) {
      setNote({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در انجام عملیات.' });
    } finally {
      setBusy(false);
    }
  }

  const total = sumWeights(process.dimensions);

  return (
    <div className="space-y-6">
      {note ? <Alert variant={note.type}>{note.text}</Alert> : null}

      <Card>
        <CardHeader
          title="اطلاعات فرایند"
          subtitle={`نسخه ${faDigits(process.version)} • ${faDigits(process._count.cycles)} دوره متصل`}
          actions={
            <Badge tone={process.status === 'active' ? 'success' : process.status === 'archived' ? 'muted' : 'warning'}>
              {STATUS_LABELS[process.status] ?? process.status}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام فرایند" htmlFor="pe-name" required>
              <Input id="pe-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="مدل ارزیابی" htmlFor="pe-model">
              <Select id="pe-model" value={evaluationModel} onChange={(e) => setModel(e.target.value)}>
                {Object.entries(MODEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="توضیح" htmlFor="pe-desc">
            <Textarea id="pe-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Button
            type="button"
            disabled={busy || name.trim().length < 2}
            onClick={() =>
              void run(
                () => apiClient('PATCH', `/processes/${process.id}`, { name: name.trim(), description: description.trim(), evaluationModel }),
                'اطلاعات فرایند ذخیره شد.',
              )
            }
          >
            <Save aria-hidden className="h-4 w-4" /> ذخیره اطلاعات
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="مراحل اجرا"
          subtitle="ترتیب، مسئول و مهلت هر مرحله؛ زمان‌بندی دوره از همین مراحل ساخته می‌شود."
        />
        <CardBody className="space-y-2">
          {process.steps.length === 0 ? <p className="text-sm text-slate-400">مرحله‌ای ثبت نشده است.</p> : null}
          {process.steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index}
              total={process.steps.length}
              prevId={process.steps[index - 1]?.id}
              nextId={process.steps[index + 1]?.id}
              busy={busy}
              onRun={run}
            />
          ))}
          <AddStep processId={process.id} nextOrder={process.steps.length} busy={busy} onRun={run} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="ابعاد ارزیابی"
          subtitle="محورهای امتیازدهی و وزن هر محور"
          actions={<Badge tone={total === 100 ? 'success' : 'warning'}>مجموع وزن‌ها: {faDigits(total)}٪</Badge>}
        />
        <CardBody className="space-y-2">
          {process.dimensions.length === 0 ? <p className="text-sm text-slate-400">بعدی ثبت نشده است.</p> : null}
          {process.dimensions.map((dimension, index) => (
            <DimensionRow
              key={dimension.id}
              dimension={dimension}
              index={index}
              total={process.dimensions.length}
              prevId={process.dimensions[index - 1]?.id}
              nextId={process.dimensions[index + 1]?.id}
              busy={busy}
              onRun={run}
            />
          ))}
          <AddDimension processId={process.id} nextOrder={process.dimensions.length} busy={busy} onRun={run} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="گروه‌های هدف" subtitle="این فرایند برای کدام واحدها یا نقش‌ها تعریف می‌شود." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">واحدها</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
                {units.length === 0 ? <p className="text-xs text-slate-400">واحدی ثبت نشده است.</p> : null}
                {units.map((u) => (
                  <label key={u.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={targetUnits.includes(u.id)}
                      onChange={(e) => setTargetUnits((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))}
                    />
                    <span>{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">نقش‌ها</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
                {roles.map((r) => (
                  <label key={r.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={targetRoles.includes(r.key)}
                      onChange={(e) => setTargetRoles((prev) => (e.target.checked ? [...prev, r.key] : prev.filter((k) => k !== r.key)))}
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  apiClient('PATCH', `/processes/${process.id}`, {
                    targetGroups: [
                      ...targetUnits.map((id) => ({ type: 'unit', id })),
                      ...targetRoles.map((key) => ({ type: 'role', key })),
                    ],
                  }),
                'گروه‌های هدف ذخیره شد.',
              )
            }
          >
            <Save aria-hidden className="h-4 w-4" /> ذخیره گروه‌های هدف
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="وضعیت و عملیات" subtitle="فعال‌سازی، بایگانی یا حذف فرایند" />
        <CardBody className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || process.status === 'active'}
            onClick={() => void run(() => apiClient('PATCH', `/processes/${process.id}`, { status: 'active' }), 'فرایند فعال شد.')}
          >
            <Power aria-hidden className="h-4 w-4" /> فعال‌سازی
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || process.status === 'archived'}
            onClick={() => void run(() => apiClient('POST', `/processes/${process.id}/archive`), 'فرایند بایگانی شد.')}
          >
            <Archive aria-hidden className="h-4 w-4" /> بایگانی
          </Button>
          <Link
            href="/admin/cycles"
            className="inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ExternalLink aria-hidden className="h-4 w-4" /> دوره‌های ارزیابی
          </Link>
          <Button
            type="button"
            variant="danger"
            disabled={busy || process._count.cycles > 0}
            title={process._count.cycles > 0 ? 'این فرایند در دوره‌ها استفاده شده و فقط بایگانی می‌شود.' : undefined}
            onClick={() => {
              if (!window.confirm('این فرایند و مراحل/ابعاد آن حذف شود؟ این کار برگشت‌پذیر نیست.')) return;
              void run(async () => {
                await apiClient('DELETE', `/processes/${process.id}`);
                router.push('/admin/processes');
              }, 'فرایند حذف شد.');
            }}
          >
            <Trash2 aria-hidden className="h-4 w-4" /> حذف
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function StepRow({
  step,
  index,
  total,
  prevId,
  nextId,
  busy,
  onRun,
}: {
  step: Step;
  index: number;
  total: number;
  prevId?: number;
  nextId?: number;
  busy: boolean;
  onRun: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(step.name);
  const [owner, setOwner] = useState(step.ownerRoleKey ?? 'department_manager');
  const [sla, setSla] = useState(step.slaDays != null ? String(step.slaDays) : '');

  /** Swaps the two adjacent positions — never writes a duplicate order. */
  async function move(dir: -1 | 1) {
    const neighbour = dir === -1 ? prevId : nextId;
    const target = index + dir;
    if (neighbour == null || target < 0 || target >= total) return;
    await onRun(async () => {
      await apiClient('PATCH', `/processes/steps/${step.id}`, { order: target });
      await apiClient('PATCH', `/processes/steps/${neighbour}`, { order: index });
    }, 'ترتیب مراحل به‌روزرسانی شد.');
  }

  return (
    <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <span className="ml-2 text-xs text-slate-400">{faDigits(index + 1)}.</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{step.name}</span>
          <span className="mr-2 text-xs text-slate-500">
            {OWNER_OPTIONS.find((o) => o.key === step.ownerRoleKey)?.label ?? '—'}
            {step.slaDays != null ? ` • ${faDigits(step.slaDays)} روز` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button type="button" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" disabled={busy || index === 0} onClick={() => void move(-1)}>▲</button>
          <button type="button" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" disabled={busy || index === total - 1} onClick={() => void move(1)}>▼</button>
          <button type="button" className="rounded px-2 py-1 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40" onClick={() => setEdit((v) => !v)}>
            {edit ? 'بستن' : 'ویرایش'}
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`مرحله «${step.name}» حذف شود؟`)) return;
              void onRun(() => apiClient('DELETE', `/processes/steps/${step.id}`), 'مرحله حذف شد.');
            }}
          >
            حذف
          </button>
        </div>
      </div>

      {edit ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <Input aria-label="نام مرحله" value={name} onChange={(e) => setName(e.target.value)} />
          <Select aria-label="مسئول" value={owner} onChange={(e) => setOwner(e.target.value)}>
            {OWNER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </Select>
          <Input aria-label="مهلت روز" dir="ltr" type="number" min={0} className="w-24" value={sla} onChange={(e) => setSla(e.target.value)} />
          <Button
            type="button"
            disabled={busy || name.trim().length < 2}
            onClick={() =>
              void onRun(async () => {
                await apiClient('PATCH', `/processes/steps/${step.id}`, {
                  name: name.trim(),
                  ownerType: 'role',
                  ownerRoleKey: owner,
                  slaDays: sla ? Number(sla) : null,
                });
                setEdit(false);
              }, 'مرحله ذخیره شد.')
            }
          >
            <Save aria-hidden className="h-4 w-4" /> ذخیره
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AddStep({
  processId,
  nextOrder,
  busy,
  onRun,
}: {
  processId: number;
  nextOrder: number;
  busy: boolean;
  onRun: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('department_manager');
  const [sla, setSla] = useState('7');

  return (
    <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_auto_auto_auto] dark:border-slate-800">
      <Input aria-label="نام مرحله جدید" placeholder="مرحله جدید" value={name} onChange={(e) => setName(e.target.value)} />
      <Select aria-label="مسئول مرحله جدید" value={owner} onChange={(e) => setOwner(e.target.value)}>
        {OWNER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </Select>
      <Input aria-label="مهلت" dir="ltr" type="number" min={0} className="w-24" value={sla} onChange={(e) => setSla(e.target.value)} />
      <Button
        type="button"
        variant="secondary"
        disabled={busy || name.trim().length < 2}
        onClick={() =>
          void onRun(async () => {
            await apiClient('POST', `/processes/${processId}/steps`, {
              name: name.trim(),
              order: nextOrder,
              ownerType: 'role',
              ownerRoleKey: owner,
              slaDays: sla ? Number(sla) : null,
            });
            setName('');
          }, 'مرحله افزوده شد.')
        }
      >
        <Plus aria-hidden className="h-4 w-4" /> افزودن
      </Button>
    </div>
  );
}

function DimensionRow({
  dimension,
  index,
  total,
  prevId,
  nextId,
  busy,
  onRun,
}: {
  dimension: Dimension;
  index: number;
  total: number;
  prevId?: number;
  nextId?: number;
  busy: boolean;
  onRun: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(dimension.name);
  const [weight, setWeight] = useState(dimension.weight);
  const [owner, setOwner] = useState(dimension.ownerRoleKey ?? 'department_manager');

  /** Swaps the two adjacent positions — never writes a duplicate sort order. */
  async function move(dir: -1 | 1) {
    const neighbour = dir === -1 ? prevId : nextId;
    const target = index + dir;
    if (neighbour == null || target < 0 || target >= total) return;
    await onRun(async () => {
      await apiClient('PATCH', `/processes/dimensions/${dimension.id}`, { sortOrder: target });
      await apiClient('PATCH', `/processes/dimensions/${neighbour}`, { sortOrder: index });
    }, 'ترتیب ابعاد به‌روزرسانی شد.');
  }

  return (
    <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <span className="ml-2 text-xs text-slate-400">{faDigits(index + 1)}.</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{dimension.name}</span>
          <span className="mr-2 text-xs text-slate-500">
            وزن {faDigits(Number(dimension.weight))} • {OWNER_OPTIONS.find((o) => o.key === dimension.ownerRoleKey)?.label ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button type="button" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" disabled={busy || index === 0} onClick={() => void move(-1)}>▲</button>
          <button type="button" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" disabled={busy || index === total - 1} onClick={() => void move(1)}>▼</button>
          <button type="button" className="rounded px-2 py-1 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40" onClick={() => setEdit((v) => !v)}>
            {edit ? 'بستن' : 'ویرایش'}
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`بعد «${dimension.name}» حذف شود؟`)) return;
              void onRun(() => apiClient('DELETE', `/processes/dimensions/${dimension.id}`), 'بعد حذف شد.');
            }}
          >
            حذف
          </button>
        </div>
      </div>

      {edit ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <Input aria-label="نام بعد" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="وزن" dir="ltr" type="number" min={0} className="w-24" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <Select aria-label="مسئول" value={owner} onChange={(e) => setOwner(e.target.value)}>
            {OWNER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </Select>
          <Button
            type="button"
            disabled={busy || name.trim().length < 2}
            onClick={() =>
              void onRun(async () => {
                await apiClient('PATCH', `/processes/dimensions/${dimension.id}`, {
                  name: name.trim(),
                  weight: Number(weight) || 0,
                  ownerRoleKey: owner,
                });
                setEdit(false);
              }, 'بعد ذخیره شد.')
            }
          >
            <Save aria-hidden className="h-4 w-4" /> ذخیره
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AddDimension({
  processId,
  nextOrder,
  busy,
  onRun,
}: {
  processId: number;
  nextOrder: number;
  busy: boolean;
  onRun: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('25');
  const [owner, setOwner] = useState('department_manager');

  return (
    <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_auto_auto_auto] dark:border-slate-800">
      <Input aria-label="نام بعد جدید" placeholder="بعد جدید" value={name} onChange={(e) => setName(e.target.value)} />
      <Input aria-label="وزن بعد جدید" dir="ltr" type="number" min={0} className="w-24" value={weight} onChange={(e) => setWeight(e.target.value)} />
      <Select aria-label="مسئول بعد جدید" value={owner} onChange={(e) => setOwner(e.target.value)}>
        {OWNER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </Select>
      <Button
        type="button"
        variant="secondary"
        disabled={busy || name.trim().length < 2}
        onClick={() =>
          void onRun(async () => {
            await apiClient('POST', `/processes/${processId}/dimensions`, {
              name: name.trim(),
              weight: Number(weight) || 0,
              ownerRoleKey: owner,
              sortOrder: nextOrder,
            });
            setName('');
          }, 'بعد افزوده شد.')
        }
      >
        <Plus aria-hidden className="h-4 w-4" /> افزودن
      </Button>
    </div>
  );
}
