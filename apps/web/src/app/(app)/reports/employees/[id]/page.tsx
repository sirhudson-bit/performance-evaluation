import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiData, getSession, hasPermission } from '@/lib/api';
import {
  PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge, Alert, Badge, KpiTile, ProgressBar,
} from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { formatJalali, formatScore, formatPercent, faDigits } from '@/lib/format';

interface EvaluatorBreakdown {
  evaluatorId: string;
  evaluatorRole: string;
  weight: number;
  included: boolean;
  formScore: number | null;
  sections?: { sectionId: string; score: number | null; weightUsed: number }[];
}
interface Breakdown {
  evaluators?: EvaluatorBreakdown[];
}

interface Report {
  employee: {
    id: number;
    employeeNo: string;
    name: string;
    email: string | null;
    phone: string | null;
    hireDate: string | null;
    status: string;
    unit: string | null;
    position: string | null;
    manager: string | null;
    account: { id: number; email: string; lastLoginAt: string | null } | null;
  };
  summary: {
    cycles: number;
    scored: number;
    average: number | null;
    latest: {
      score: number | null;
      status: string;
      publishedAt: string | null;
      cycle: { id: number; name: string; startDate: string; endDate: string; status: string };
      breakdown: Breakdown | null;
    } | null;
    activePlans: number;
    activeAgreements: number;
    assignments: { total: number; completed: number };
  };
  results: {
    id: number;
    score: number | null;
    status: string;
    publishedAt: string | null;
    cycle: { id: number; name: string; startDate: string; endDate: string; status: string };
  }[];
  assignments: {
    id: number;
    evaluatorRole: string;
    status: string;
    weight: number;
    submittedAt: string | null;
    dueDate: string | null;
    cycle: { id: number; name: string };
    score: number | null;
  }[];
  agreements: {
    id: number;
    title: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    indicators: { id: number; name: string; target: number | null; actual: number | null; weight: number; progress: number }[];
  }[];
  improvementPlans: { id: number; title: string; status: string; dueDate: string | null; actions: unknown }[];
  appeals: { id: number; cycleId: number; reason: string; status: string; scoreBefore: number | null; scoreAfter: number | null; createdAt: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  self: 'خودارزیابی',
  manager: 'مدیر مستقیم',
  peer: 'همکار',
  report: 'زیردست',
  hr: 'منابع انسانی',
  other: 'سایر',
};

const PLAN_STATUS: Record<string, string> = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  in_progress: 'در جریان',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};

export default async function EmployeeReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!hasPermission(user, 'reports.view')) {
    return (
      <>
        <PageHeader title="گزارش عملکرد" />
        <Alert variant="danger">برای مشاهده این گزارش به دسترسی «مشاهده گزارش‌ها» نیاز دارید.</Alert>
      </>
    );
  }

  const { id } = await params;
  const report = await apiData<Report>(`/reports/employees/${id}`);
  if (!report) notFound();

  const { employee, summary } = report;
  const evaluators = summary.latest?.breakdown?.evaluators ?? [];

  return (
    <>
      <PageHeader
        title={`گزارش عملکرد ${employee.name}`}
        description={`شماره پرسنلی ${employee.employeeNo}${employee.unit ? ` · ${employee.unit}` : ''}${employee.position ? ` · ${employee.position}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PrintButton />
            <Link href="/reports/employees" className="text-sm text-brand-700 hover:underline dark:text-brand-300">بازگشت به فهرست</Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="آخرین امتیاز" value={summary.latest ? formatScore(summary.latest.score) : '—'} hint={summary.latest ? summary.latest.cycle.name : 'بدون نتیجه'} />
        <KpiTile label="میانگین دوره‌ها" value={formatScore(summary.average)} hint={`${faDigits(summary.scored)} دوره امتیازدار`} />
        <KpiTile label="توافق‌نامه فعال" value={faDigits(summary.activeAgreements)} hint={`${faDigits(summary.activePlans)} برنامه بهبود فعال`} />
        <KpiTile label="تکمیل ارزیابی‌ها" value={`${faDigits(summary.assignments.completed)}/${faDigits(summary.assignments.total)}`} hint="فرم‌های ارسال‌شده" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="مشخصات کارمند" />
          <CardBody>
            <dl className="space-y-3 text-sm">
              {[
                ['واحد', employee.unit ?? '—'],
                ['عنوان شغلی', employee.position ?? '—'],
                ['مدیر مستقیم', employee.manager ?? '—'],
                ['تاریخ استخدام', formatJalali(employee.hireDate)],
                ['وضعیت', employee.status],
                ['ایمیل سازمانی', employee.account?.email ?? employee.email ?? '—'],
                ['آخرین ورود', formatJalali(employee.account?.lastLoginAt, { withTime: true })],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="max-w-full break-words text-left font-medium text-slate-800 dark:text-slate-100">{value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="روند امتیاز در دوره‌ها" subtitle={`${faDigits(report.results.length)} دوره`} />
          {report.results.length === 0 ? (
            <EmptyState title="نتیجه‌ای ثبت نشده است" description="پس از انتشار نتایج دوره، این بخش تکمیل می‌شود." />
          ) : (
            <Table head={['دوره', 'بازه', 'امتیاز نهایی', 'وضعیت', 'انتشار']}>
              {report.results.map((r) => (
                <tr key={r.id}>
                  <Td>{r.cycle.name}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatJalali(r.cycle.startDate)} تا {formatJalali(r.cycle.endDate)}</Td>
                  <Td className="tabular font-medium">{formatScore(r.score)}</Td>
                  <Td><StatusBadge group="assignmentStatus" value={r.status} /></Td>
                  <Td className="whitespace-nowrap text-xs">{formatJalali(r.publishedAt)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="تفکیک امتیاز آخرین دوره"
            subtitle={summary.latest ? summary.latest.cycle.name : 'بدون دوره'}
          />
          {evaluators.length === 0 ? (
            <EmptyState title="تفکیک ارزیاب‌ها در دسترس نیست" description="برای دوره‌ای که نتیجه منتشرشده دارد، این جدول نمایش داده می‌شود." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {evaluators.map((e) => (
                <div key={`${e.evaluatorId}-${e.evaluatorRole}`} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{ROLE_LABELS[e.evaluatorRole] ?? e.evaluatorRole}</span>
                    <span className="text-sm tabular text-slate-600 dark:text-slate-300">
                      {formatScore(e.formScore)} {e.included ? null : <Badge tone="muted">شمارش‌نشده</Badge>}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">وزن ارزیاب: {faDigits(e.weight)}</p>
                  <div className="mt-2"><ProgressBar value={e.formScore ?? 0} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="وضعیت فرم‌های ارزیابی" subtitle={`${faDigits(report.assignments.length)} فرم`} />
          {report.assignments.length === 0 ? (
            <EmptyState title="فرمی ثبت نشده است" />
          ) : (
            <Table head={['دوره', 'نقش ارزیاب', 'وضعیت', 'وزن', 'امتیاز']}>
              {report.assignments.map((a) => (
                <tr key={a.id}>
                  <Td>{a.cycle.name}</Td>
                  <Td>{ROLE_LABELS[a.evaluatorRole] ?? a.evaluatorRole}</Td>
                  <Td><StatusBadge group="assignmentStatus" value={a.status} /></Td>
                  <Td className="tabular">{faDigits(a.weight)}</Td>
                  <Td className="tabular">{formatScore(a.score)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="توافق‌نامه‌های عملکرد" subtitle={`${faDigits(report.agreements.length)} توافق‌نامه`} />
        {report.agreements.length === 0 ? (
          <EmptyState title="توافق‌نامه‌ای ثبت نشده است" />
        ) : (
          <CardBody className="space-y-5">
            {report.agreements.map((a) => (
              <div key={a.id} className="rounded border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</h3>
                  <Badge tone={a.status === 'active' ? 'success' : 'muted'}>{a.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatJalali(a.startDate)} تا {formatJalali(a.endDate)}
                </p>
                <div className="mt-3 space-y-2">
                  {a.indicators.map((i) => (
                    <div key={i.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="break-words">{i.name}</span>
                        <span className="tabular">{formatPercent(i.progress)}</span>
                      </div>
                      <div className="mt-1"><ProgressBar value={i.progress} /></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="برنامه‌های بهبود" subtitle={`${faDigits(report.improvementPlans.length)} برنامه`} />
          {report.improvementPlans.length === 0 ? (
            <EmptyState title="برنامه‌ای ثبت نشده است" />
          ) : (
            <Table head={['عنوان', 'وضعیت', 'مهلت']}>
              {report.improvementPlans.map((p) => (
                <tr key={p.id}>
                  <Td>{p.title}</Td>
                  <Td><Badge tone="muted">{PLAN_STATUS[p.status] ?? p.status}</Badge></Td>
                  <Td className="whitespace-nowrap text-xs">{formatJalali(p.dueDate)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="اعتراض‌ها" subtitle={`${faDigits(report.appeals.length)} مورد`} />
          {report.appeals.length === 0 ? (
            <EmptyState title="اعتراضی ثبت نشده است" />
          ) : (
            <Table head={['دلیل', 'وضعیت', 'امتیاز قبل/بعد', 'تاریخ']}>
              {report.appeals.map((a) => (
                <tr key={a.id}>
                  <Td className="max-w-[18rem] whitespace-normal break-words">{a.reason}</Td>
                  <Td><StatusBadge group="appealStatus" value={a.status} /></Td>
                  <Td className="whitespace-nowrap tabular text-xs">{formatScore(a.scoreBefore)} / {formatScore(a.scoreAfter)}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatJalali(a.createdAt)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        این گزارش بر اساس نتایج منتشرشده و داده‌های ارزیابی همین کارمند تولید شده است. دسترسی شما به این فرد توسط ساختار سازمانی تعیین می‌شود.
      </p>
    </>
  );
}
