import Link from 'next/link';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, Table, Td, EmptyState, StatusBadge, Alert, Badge, Input, Button } from '@/components/ui';
import { formatJalali, formatScore } from '@/lib/format';

interface Row {
  id: number;
  employeeNo: string;
  name: string;
  unit: string | null;
  position: string | null;
  latest: { score: number | null; status: string; publishedAt: string | null; cycle: { id: number; name: string } } | null;
}

/** Directory for the per-person report, scoped to the caller. */
export default async function EmployeeReportsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getSession();
  if (!hasPermission(user, 'reports.view')) {
    return (
      <>
        <PageHeader title="گزارش عملکرد افراد" />
        <Alert variant="danger">برای مشاهده گزارش عملکرد افراد به دسترسی «مشاهده گزارش‌ها» نیاز دارید.</Alert>
      </>
    );
  }

  const { q = '' } = await searchParams;
  const data = await apiData<{ items: Row[] }>(`/reports/employees${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="گزارش عملکرد افراد"
        description="گزارش هر کارمند به تفکیک شخص؛ فقط افرادی که در محدوده دسترسی شما هستند."
      />

      <Card className="mb-6">
        <CardHeader title="جست‌وجوی کارمند" subtitle="نام یا شماره پرسنلی" />
        <form method="get" action="/reports/employees" className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">جست‌وجو</label>
            <Input id="q" name="q" defaultValue={q} placeholder="مثلاً مریم یا ۱۰۰۴" />
          </div>
          <div className="flex gap-2">
            <Button type="submit">جست‌وجو</Button>
            {q ? <Link href="/reports/employees" className="inline-flex items-center rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">پاک‌کردن</Link> : null}
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="کارکنان" subtitle={`${items.length} نفر`} />
        {items.length === 0 ? (
          <EmptyState title="کارمندی یافت نشد" description="عبارت جست‌وجو را تغییر دهید یا مطمئن شوید افراد در محدوده دسترسی شما هستند." />
        ) : (
          <Table head={['نام', 'شماره پرسنلی', 'واحد', 'عنوان شغلی', 'آخرین امتیاز', 'دوره', 'وضعیت', '']}>
            {items.map((row) => (
              <tr key={row.id}>
                <Td>{row.name}</Td>
                <Td className="tabular">{row.employeeNo}</Td>
                <Td>{row.unit ?? '—'}</Td>
                <Td>{row.position ?? '—'}</Td>
                <Td className="tabular font-medium">{row.latest ? formatScore(row.latest.score) : '—'}</Td>
                <Td>{row.latest?.cycle.name ?? '—'}</Td>
                <Td>{row.latest ? <StatusBadge group="assignmentStatus" value={row.latest.status} /> : <Badge tone="muted">بدون نتیجه</Badge>}</Td>
                <Td>
                  <Link href={`/reports/employees/${row.id}`} className="whitespace-nowrap text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                    مشاهده گزارش
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        آخرین به‌روزرسانی: {formatJalali(new Date())}
      </p>
    </>
  );
}
