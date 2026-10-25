import { apiData, getSession } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, KpiTile, Table, Td, EmptyState, StatusBadge, Badge, Alert } from '@/components/ui';
import { formatScore, formatJalali, faDigits } from '@/lib/format';

interface Result { id: number; finalScore: string | null; status: string; cycle: { name: string } }
interface Agreement { id: number; title: string; status: string; indicators: { id: number; name: string; progress: number; targetValue: string | null; actualValue: string | null }[] }
interface Plan { id: number; title: string; status: string; dueDate: string | null }

/** "My Performance": the employee's own status — results, agreements, plans. */
export default async function MyPerformancePage() {
  const user = await getSession();
  const [results, agreements, plans] = await Promise.all([
    apiData<{ items: Result[] }>('/evaluations/results/list'),
    apiData<{ items: Agreement[] }>('/agreements'),
    apiData<{ items: Plan[] }>('/improvement-plans'),
  ]);

  const myResults = (results?.items ?? []).slice(0, 5);
  const myAgreements = agreements?.items ?? [];
  const myPlans = plans?.items ?? [];
  const latest = myResults[0];

  return (
    <>
      <PageHeader title="عملکرد من" description="تصویر یکجای وضعیت عملکرد شما" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="آخرین امتیاز منتشرشده" value={latest ? formatScore(latest.finalScore) : '—'} hint={latest ? latest.cycle.name : undefined} tone="info" />
        <KpiTile label="تعداد نتایج" value={faDigits(myResults.length)} />
        <KpiTile label="توافق‌نامه‌های فعال" value={faDigits(myAgreements.filter((a) => a.status === 'active').length)} />
        <KpiTile label="برنامه‌های بهبود" value={faDigits(myPlans.length)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="نتایج من" subtitle="بر پایه دوره‌های منتشرشده" />
          {myResults.length === 0 ? (
            <EmptyState title="نتیجه‌ای منتشر نشده است" />
          ) : (
            <Table head={['دوره', 'امتیاز', 'وضعیت']}>
              {myResults.map((r) => (
                <tr key={r.id}>
                  <Td>{r.cycle.name}</Td>
                  <Td className="tabular font-medium">{formatScore(r.finalScore)}</Td>
                  <Td><StatusBadge group="assignmentStatus" value={r.status} /></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="توافق‌نامه‌های عملکرد من" />
          {myAgreements.length === 0 ? (
            <EmptyState title="توافق‌نامه‌ای ثبت نشده است" />
          ) : (
            <CardBody className="space-y-3">
              {myAgreements.map((a) => (
                <div key={a.id} className="rounded border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.title}</p>
                    <Badge tone={a.status === 'completed' ? 'success' : a.status === 'active' ? 'info' : 'muted'}>{a.status}</Badge>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {a.indicators.map((i) => (
                      <li key={i.id} className="flex items-center justify-between">
                        <span>{i.name}</span>
                        <span>هدف {i.targetValue ?? '—'} • پیشرفت {faDigits(i.progress)}٪</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="برنامه‌های بهبود من" />
        {myPlans.length === 0 ? (
          <EmptyState title="برنامه‌ای ثبت نشده است" />
        ) : (
          <Table head={['عنوان', 'وضعیت', 'مهلت']}>
            {myPlans.map((p) => (
              <tr key={p.id}>
                <Td>{p.title}</Td>
                <Td><StatusBadge group="improvementPlanStatus" value={p.status} /></Td>
                <Td>{formatJalali(p.dueDate)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {!user ? <Alert variant="warning">برای مشاهده این صفحه باید وارد شوید.</Alert> : null}
    </>
  );
}
