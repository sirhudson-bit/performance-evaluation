import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardBody, CardHeader, Alert, Badge, LinkButton } from '@/components/ui';
import { faDigits } from '@/lib/format';
import { ProcessEditor } from '@/components/ProcessEditor';
import { MODEL_LABELS, OWNER_OPTIONS, STATUS_LABELS } from '@/components/processPresets';

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
interface Role { id: number; key: string; name: string; isProtected: boolean }

export default async function ProcessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSession();
  const data = await apiData<{ process: Proc }>(`/processes/${id}`);
  if (!data?.process) notFound();
  const proc = data.process;
  const canManage = hasPermission(me, 'processes.manage');

  if (!canManage) {
    return (
      <>
        <PageHeader title={proc.name} description={MODEL_LABELS[proc.evaluationModel] ?? proc.evaluationModel} />
        <Card>
          <CardHeader title="مراحل و ابعاد" subtitle={`نسخه ${faDigits(proc.version)}`} actions={<Badge tone="muted">{STATUS_LABELS[proc.status] ?? proc.status}</Badge>} />
          <CardBody className="space-y-3 text-sm">
            <p className="text-slate-500">شما دسترسی ویرایش ندارید؛ این صفحه فقط برای مشاهده است.</p>
            <ol className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {proc.steps.map((s, i) => (
                <li key={s.id}>{faDigits(i + 1)}. {s.name} — {OWNER_OPTIONS.find((o) => o.key === s.ownerRoleKey)?.label ?? '—'}</li>
              ))}
            </ol>
            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {proc.dimensions.map((d) => <li key={d.id}>{d.name} — وزن {faDigits(Number(d.weight))}</li>)}
            </ul>
            <Link href="/admin/processes" className="text-brand-700 hover:underline dark:text-brand-300">بازگشت به فهرست</Link>
          </CardBody>
        </Card>
      </>
    );
  }

  const [units, roles] = await Promise.all([
    apiData<{ items: Unit[] }>('/organization/units'),
    apiData<{ items: Role[] }>('/roles'),
  ]);

  return (
    <>
      <PageHeader
        title={proc.name}
        description="مدیریت مراحل، ابعاد، گروه‌های هدف و وضعیت فرایند"
        actions={<LinkButton href="/admin/processes" variant="secondary">بازگشت به فهرست</LinkButton>}
      />
      {proc.steps.length === 0 ? (
        <div className="mb-4"><Alert variant="warning">این فرایند هنوز مرحله‌ای ندارد؛ بدون مرحله، زمان‌بندی دوره ساخته نمی‌شود.</Alert></div>
      ) : null}
      <ProcessEditor
        process={proc}
        units={(units?.items ?? []).map((u) => ({ id: u.id, name: u.name }))}
        roles={(roles?.items ?? []).filter((r) => !r.isProtected).map((r) => ({ key: r.key, name: r.name }))}
      />
    </>
  );
}
