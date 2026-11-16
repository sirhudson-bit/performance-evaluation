import Link from 'next/link';
import { Target, GitBranch, ListChecks, Layers, Plus } from 'lucide-react';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, EmptyState, Alert, Badge, LinkButton, KpiTile } from '@/components/ui';
import { faDigits } from '@/lib/format';
import { MODEL_LABELS, STATUS_LABELS, sumWeights } from '@/components/processPresets';

interface Step { id: number; name: string; order: number }
interface Dimension { id: number; name: string; weight: string }
interface Proc {
  id: number;
  name: string;
  description: string | null;
  evaluationModel: string;
  status: string;
  version: number;
  steps: Step[];
  dimensions: Dimension[];
  _count: { cycles: number };
}

export default async function AdminProcessesPage() {
  const user = await getSession();
  const canManage = hasPermission(user, 'processes.manage');
  const data = await apiData<{ items: Proc[] }>('/processes');
  const items = data?.items ?? [];

  const active = items.filter((p) => p.status === 'active').length;
  const drafts = items.filter((p) => p.status === 'draft').length;
  const cycles = items.reduce((n, p) => n + p._count.cycles, 0);

  return (
    <>
      <PageHeader
        title="فرایندهای مدیریت عملکرد"
        description="هر فرایند از چند مرحله با مسئول و مهلت، و چند بعد امتیازدهی ساخته می‌شود. با ویزارد، فرایند در چهار قدم آماده می‌شود."
        actions={
          canManage ? (
            <LinkButton href="/admin/processes/new">
              <Plus aria-hidden className="h-4 w-4" /> فرایند جدید
            </LinkButton>
          ) : undefined
        }
      />

      {!canManage ? (
        <div className="mb-6">
          <Alert variant="info">برای ایجاد یا ویرایش فرایند به دسترسی مدیریتی نیاز دارید؛ نسخه فعلی فقط قابل مشاهده است.</Alert>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="کل فرایندها" value={faDigits(items.length)} />
        <KpiTile label="فعال" value={faDigits(active)} tone="success" />
        <KpiTile label="پیش‌نویس" value={faDigits(drafts)} tone="warning" />
        <KpiTile label="دوره‌های متصل" value={faDigits(cycles)} tone="info" />
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="فرایندی ثبت نشده است"
            description="با «فرایند جدید» یک الگوی آماده انتخاب کنید یا از صفر مراحل و ابعاد را بسازید."
            action={canManage ? <LinkButton href="/admin/processes/new"><Plus aria-hidden className="h-4 w-4" /> ساخت اولین فرایند</LinkButton> : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((p) => {
            const total = sumWeights(p.dimensions);
            return (
              <Card key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <div className="min-w-0">
                    <Link href={`/admin/processes/${p.id}`} className="block truncate font-semibold text-slate-900 hover:underline dark:text-slate-100">
                      {p.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">{MODEL_LABELS[p.evaluationModel] ?? p.evaluationModel}</p>
                  </div>
                  <Badge tone={p.status === 'active' ? 'success' : p.status === 'archived' ? 'muted' : 'warning'}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </div>

                <div className="flex-1 space-y-3 px-5 py-4">
                  {p.description ? <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{p.description}</p> : null}

                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2"><ListChecks aria-hidden className="h-3.5 w-3.5 text-slate-400" /> {faDigits(p.steps.length)} مرحله</li>
                    <li className="flex items-center gap-2">
                      <Layers aria-hidden className="h-3.5 w-3.5 text-slate-400" /> {faDigits(p.dimensions.length)} بعد
                      {p.dimensions.length > 0 ? <Badge tone={total === 100 ? 'success' : 'warning'}>وزن {faDigits(total)}٪</Badge> : null}
                    </li>
                    <li className="flex items-center gap-2"><GitBranch aria-hidden className="h-3.5 w-3.5 text-slate-400" /> {faDigits(p._count.cycles)} دوره ارزیابی</li>
                  </ul>

                  {p.steps.length > 0 ? (
                    <p className="text-xs text-slate-400">
                      {p.steps.slice(0, 4).map((s, i) => `${faDigits(i + 1)}. ${s.name}`).join(' • ')}
                      {p.steps.length > 4 ? ' …' : ''}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
                  <Link href={`/admin/processes/${p.id}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300">
                    <Target aria-hidden className="h-4 w-4" /> {canManage ? 'مدیریت فرایند' : 'مشاهده جزئیات'}
                  </Link>
                  <span className="text-xs text-slate-400">نسخه {faDigits(p.version)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
