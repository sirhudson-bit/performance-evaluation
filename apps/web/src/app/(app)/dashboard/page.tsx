import { apiData, getSession, hasPermission } from '@/lib/api';
import { Card, CardHeader, CardBody, KpiTile, PageHeader, StatusBadge, Table, Td, EmptyState, LinkButton, ProgressBar } from '@/components/ui';
import { faDigits, formatScore, formatJalali } from '@/lib/format';

interface AssignmentListItem {
  id: number;
  status: string;
  dueDate: string | null;
  cycle: { id: number; name: string; endDate: string };
  employee: { firstName: string; lastName: string };
}
interface ResultListItem {
  id: number;
  finalScore: string | null;
  status: string;
  cycle: { name: string };
  employee: { firstName: string; lastName: string };
}
interface AdminOverview {
  users: number;
  employees: number;
  activeCycles: number;
  pendingReviews: number;
  jobs: Record<string, number>;
  failedLogins: number;
}

export default async function DashboardPage() {
  const user = await getSession();
  const [assignments, results, overview] = await Promise.all([
    apiData<{ items: AssignmentListItem[] }>('/evaluations'),
    apiData<{ items: ResultListItem[] }>('/evaluations/results/list'),
    hasPermission(user, 'settings.view') ? apiData<AdminOverview>('/admin/overview') : Promise.resolve(null),
  ]);

  const mine = assignments?.items ?? [];
  const pending = mine.filter((a) => ['assigned', 'in_progress', 'returned_for_revision'].includes(a.status));
  const submitted = mine.filter((a) => !['assigned', 'in_progress', 'draft'].includes(a.status));
  const completion = mine.length > 0 ? Math.round((submitted.length / mine.length) * 100) : 0;

  return (
    <>
      <PageHeader title={`سلام، ${user?.name ?? ''}`} description="نمای کلی وظایف و وضعیت ارزیابی‌های شما" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="ارزیابی‌های در انتظار شما" value={faDigits(pending.length)} tone="warning" hint={pending.length > 0 ? 'نیازمند اقدام' : undefined} />
        <KpiTile label="ارزیابی‌های تکمیل‌شده" value={faDigits(submitted.length)} tone="success" />
        <KpiTile label="نتایج قابل مشاهده" value={faDigits(results?.items.length ?? 0)} />
        <KpiTile label="نرخ تکمیل شما" value={`${faDigits(completion)}٪`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="ارزیابی‌های در انتظار اقدام" actions={<LinkButton href="/evaluations" variant="secondary">همه ارزیابی‌ها</LinkButton>} />
          {pending.length === 0 ? (
            <EmptyState title="موردی در انتظار اقدام نیست" description="در حال حاضر ارزیابی‌ای برای تکمیل ندارید." />
          ) : (
            <Table head={['کارمند', 'دوره', 'وضعیت', 'مهلت', '']}>
              {pending.map((a) => (
                <tr key={a.id}>
                  <Td>{a.employee.firstName} {a.employee.lastName}</Td>
                  <Td>{a.cycle.name}</Td>
                  <Td><StatusBadge group="assignmentStatus" value={a.status} /></Td>
                  <Td>{formatJalali(a.dueDate)}</Td>
                  <Td><LinkButton href={`/evaluations/${a.id}`} variant="ghost">تکمیل</LinkButton></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="پیشرفت ارزیابی‌ها" />
            <CardBody>
              <ProgressBar value={completion} label={`${faDigits(submitted.length)} از ${faDigits(mine.length)} تکمیل شده`} />
            </CardBody>
          </Card>

          {overview ? (
            <Card>
              <CardHeader title="نمای مدیر سامانه" />
              <CardBody className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-500">کاربران</p><p className="text-lg font-bold tabular">{faDigits(overview.users)}</p></div>
                <div><p className="text-slate-500">کارکنان فعال</p><p className="text-lg font-bold tabular">{faDigits(overview.employees)}</p></div>
                <div><p className="text-slate-500">دوره‌های جاری</p><p className="text-lg font-bold tabular">{faDigits(overview.activeCycles)}</p></div>
                <div><p className="text-slate-500">در انتظار بررسی</p><p className="text-lg font-bold tabular">{faDigits(overview.pendingReviews)}</p></div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="آخرین نتایج منتشرشده" actions={<LinkButton href="/results" variant="secondary">همه نتایج</LinkButton>} />
        {!results || results.items.length === 0 ? (
          <EmptyState title="نتیجه‌ای منتشر نشده است" description="پس از انتشار نتایج، در این بخش نمایش داده می‌شوند." />
        ) : (
          <Table head={['کارمند', 'دوره', 'امتیاز نهایی', 'وضعیت']}>
            {results.items.slice(0, 5).map((r) => (
              <tr key={r.id}>
                <Td>{r.employee.firstName} {r.employee.lastName}</Td>
                <Td>{r.cycle.name}</Td>
                <Td className="tabular">{formatScore(r.finalScore)}</Td>
                <Td><StatusBadge group="assignmentStatus" value={r.status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
