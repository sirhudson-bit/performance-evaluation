import Link from 'next/link';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, Table, Td, EmptyState, StatusBadge, Alert } from '@/components/ui';
import { formatScore } from '@/lib/format';
import type { Analytics } from '@/components/ReportsCharts';
import { ReportsChartsLazy } from '@/components/ReportsChartsLazy';

interface Item {
  id: number;
  finalScore: string | null;
  status: string;
  employee: { id: number; firstName: string; lastName: string; employeeNo: string };
  cycle: { name: string };
}

/**
 * "Evaluation Results": the result list plus analytical charts — score
 * distribution, status, and averages broken down by organizational unit and by
 * position. All data is scope-filtered on the server.
 */
export default async function ResultsPage() {
  const user = await getSession();
  const canSeeCharts = hasPermission(user, 'reports.view');

  const [data, analytics] = await Promise.all([
    apiData<{ items: Item[] }>('/evaluations/results/list'),
    canSeeCharts ? apiData<Analytics>('/reports/analytics') : Promise.resolve(null),
  ]);
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="نتایج ارزیابی" description="نتایج منتشرشده و تحلیل آن‌ها در محدوده دسترسی شما" />

      {analytics ? (
        <div className="mb-6">
          <ReportsChartsLazy data={analytics} />
        </div>
      ) : (
        <Alert variant="info">برای مشاهده نمودارهای تحلیلی به دسترسی «مشاهده گزارش‌ها» نیاز دارید.</Alert>
      )}

      <Card>
        {items.length === 0 ? (
          <EmptyState title="نتیجه‌ای در دسترس نیست" description="نتایج پس از انتشار توسط منابع انسانی نمایش داده می‌شوند." />
        ) : (
          <Table head={['کارمند', 'شماره پرسنلی', 'دوره', 'امتیاز نهایی', 'وضعیت', '']}>
            {items.map((r) => (
              <tr key={r.id}>
                <Td>{r.employee.firstName} {r.employee.lastName}</Td>
                <Td className="tabular">{r.employee.employeeNo}</Td>
                <Td>{r.cycle.name}</Td>
                <Td className="tabular font-medium">{formatScore(r.finalScore)}</Td>
                <Td><StatusBadge group="assignmentStatus" value={r.status} /></Td>
                <Td>
                  <Link href={`/reports/employees/${r.employee.id}`} className="whitespace-nowrap text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                    گزارش فردی
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
