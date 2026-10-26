import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, Table, Td, EmptyState, StatusBadge, Alert, LinkButton } from '@/components/ui';
import { formatJalali, faDigits } from '@/lib/format';
import { ReportExportForm } from '@/components/ReportExportForm';
import type { Analytics } from '@/components/ReportsCharts';
import { ReportsChartsLazy } from '@/components/ReportsChartsLazy';

interface ExportItem {
  id: number;
  report: string;
  format: string;
  status: string;
  rows: number | null;
  size: number | null;
  createdAt: string;
  expiresAt: string | null;
}

const REPORT_LABELS: Record<string, string> = {
  executive_summary: 'خلاصه اجرایی',
  employee_results: 'نتایج کارکنان',
  answers_detail: 'جزئیات پاسخ‌ها',
  responses_by_user: 'پاسخ‌های کاربران',
  scores_breakdown: 'تفکیک امتیازها',
  comparison: 'مقایسه',
  completion_status: 'وضعیت تکمیل',
  appeals: 'اعتراض‌ها',
  compensation: 'جبران خدمات',
};

export default async function ReportsPage() {
  const user = await getSession();
  const canExportResponses = hasPermission(user, 'settings.manage');
  const [cycles, exportsData, analytics] = await Promise.all([
    apiData<{ items: { id: number; name: string }[] }>('/evaluation-cycles'),
    apiData<{ items: ExportItem[] }>('/reports/exports'),
    apiData<Analytics>('/reports/analytics'),
  ]);

  return (
    <>
      <PageHeader
        title="گزارش‌ها و خروجی اکسل"
        description="نمودارها، خروجی اکسل، وضعیت تکمیل و گزارش عملکرد هر فرد"
        actions={<LinkButton href="/reports/employees" variant="secondary">گزارش عملکرد افراد</LinkButton>}
      />

      <Alert variant="info">
        خروجی‌ها در پس‌زمینه ساخته می‌شوند و فقط ردیف‌هایی را شامل می‌شوند که مجاز به مشاهده آن‌ها هستید. لینک دانلود پس از هفت روز منقضی می‌شود.
      </Alert>

      {analytics ? (
        <div className="mt-6">
          <ReportsChartsLazy data={analytics} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="خروجی جدید" />
          <div className="p-5">
            <ReportExportForm cycles={cycles?.items ?? []} canExportResponses={canExportResponses} />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="خروجی‌های recent" subtitle={`${faDigits(exportsData?.items.length ?? 0)} مورد`} />
          {!exportsData || exportsData.items.length === 0 ? (
            <EmptyState title="خروجی‌ای ساخته نشده است" />
          ) : (
            <Table head={['گزارش', 'قالب', 'وضعیت', 'ردیف', 'تاریخ', 'انقضا', '']}>
              {exportsData.items.map((x) => (
                <tr key={x.id}>
                  <Td>{REPORT_LABELS[x.report] ?? x.report}</Td>
                  <Td>{x.format.toUpperCase()}</Td>
                  <Td><StatusBadge group="jobStatus" value={x.status} /></Td>
                  <Td className="tabular">{x.rows !== null ? faDigits(x.rows) : '—'}</Td>
                  <Td>{formatJalali(x.createdAt)}</Td>
                  <Td>{formatJalali(x.expiresAt)}</Td>
                  <Td>
                    {x.status === 'completed' ? (
                      <a className="text-brand-700 hover:underline" href={`/api/v1/reports/exports/${x.id}/download`}>
                        دانلود
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
