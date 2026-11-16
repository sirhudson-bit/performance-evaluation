import Link from 'next/link';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { Card, CardHeader, CardBody, KpiTile, StatusBadge, Table, Td, EmptyState, LinkButton, ProgressBar } from '@/components/ui';
import { faDigits, formatScore, formatJalali } from '@/lib/format';
import { ClipboardCheck, CheckCircle2, Trophy, TrendingUp, Clock3, ArrowUpLeft, Users, Building2, AlertCircle, Sparkles } from 'lucide-react';

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
  const latestResult = results?.items.find((r) => r.finalScore !== null) ?? null;

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-l from-brand-800 via-brand-700 to-sky-600 p-6 text-white shadow-xl shadow-brand-900/15 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
              <Sparkles aria-hidden className="h-3.5 w-3.5" />
              نمای کلی امروز
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">سلام، {user?.name ?? ''}</h1>
            <p className="mt-2 max-w-xl text-xs leading-7 text-white/75 sm:text-sm">
              وظایف و وضعیت ارزیابی‌های شما در یک نگاه. {pending.length > 0 ? `${faDigits(pending.length)} مورد نیازمند اقدام است.` : 'در حال حاضر موردی در انتظار اقدام نیست.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={pending.length > 0 ? `/evaluations/${pending[0]?.id}` : '/evaluations'}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-brand-800 shadow-sm transition hover:bg-brand-50"
              >
                <ClipboardCheck aria-hidden className="h-4 w-4" />
                {pending.length > 0 ? 'ادامه ارزیابی' : 'مشاهده ارزیابی‌ها'}
              </Link>
              <Link
                href="/results"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20"
              >
                <Trophy aria-hidden className="h-4 w-4" />
                نتایج من
              </Link>
            </div>
          </div>

          <div className="w-full max-w-[16rem] rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] text-white/70">
              <span>نرخ تکمیل شما</span>
              <span className="font-bold text-white">{faDigits(completion)}٪</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-white/60">
              {faDigits(submitted.length)} از {faDigits(mine.length)} ارزیابی تکمیل شده
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="ارزیابی‌های در انتظار شما"
          value={faDigits(pending.length)}
          tone={pending.length > 0 ? 'warning' : 'success'}
          hint={pending.length > 0 ? 'نیازمند اقدام' : 'همه تکمیل شده'}
          icon={<Clock3 aria-hidden className="h-5 w-5" />}
        />
        <KpiTile
          label="ارزیابی‌های تکمیل‌شده"
          value={faDigits(submitted.length)}
          tone="success"
          hint={mine.length > 0 ? 'از مجموع ارزیابی‌ها' : undefined}
          icon={<CheckCircle2 aria-hidden className="h-5 w-5" />}
        />
        <KpiTile
          label="نتایج قابل مشاهده"
          value={faDigits(results?.items.length ?? 0)}
          tone="info"
          hint="منتشرشده"
          icon={<Trophy aria-hidden className="h-5 w-5" />}
        />
        <KpiTile
          label="آخرین امتیاز شما"
          value={latestResult ? formatScore(latestResult.finalScore) : '—'}
          tone="info"
          hint={latestResult ? latestResult.cycle.name : 'نتیجهٔ منتشرشده‌ای ندارید'}
          icon={<TrendingUp aria-hidden className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="ارزیابی‌های در انتظار اقدام"
            subtitle="مواردی که برای تکمیل به شما ارجاع شده‌اند"
            icon={<ClipboardCheck aria-hidden className="h-4 w-4" />}
            actions={<LinkButton href="/evaluations" variant="secondary" size="sm">همه ارزیابی‌ها</LinkButton>}
          />
          {pending.length === 0 ? (
            <EmptyState
              title="موردی در انتظار اقدام نیست"
              description="در حال حاضر ارزیابی‌ای برای تکمیل ندارید. می‌توانید نتایج منتشرشده را ببینید."
              action={<LinkButton href="/evaluations" variant="secondary" size="sm">مشاهده ارزیابی‌های من</LinkButton>}
            />
          ) : (
            <Table head={['کارمند', 'دوره', 'وضعیت', 'مهلت', '']}>
              {pending.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <Td>
                    <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                      {a.employee.firstName} {a.employee.lastName}
                    </span>
                  </Td>
                  <Td className="text-xs">{a.cycle.name}</Td>
                  <Td><StatusBadge group="assignmentStatus" value={a.status} /></Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">{formatJalali(a.dueDate)}</Td>
                  <Td>
                    <Link href={`/evaluations/${a.id}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold text-brand-700 hover:underline dark:text-brand-300">
                      تکمیل
                      <ArrowUpLeft aria-hidden className="h-3.5 w-3.5" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="پیشرفت ارزیابی‌ها" icon={<TrendingUp aria-hidden className="h-4 w-4" />} />
            <CardBody>
              <ProgressBar value={completion} label={`${faDigits(submitted.length)} از ${faDigits(mine.length)} تکمیل شده`} />
            </CardBody>
          </Card>

          {overview ? (
            <Card>
              <CardHeader title="نمای مدیر سامانه" subtitle="آمار کل سازمان، مستقل از وظایف شخصی شما" icon={<Building2 aria-hidden className="h-4 w-4" />} />
              <CardBody className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'کاربران', value: overview.users, icon: Users },
                  { label: 'کارکنان فعال', value: overview.employees, icon: Users },
                  { label: 'دوره‌های جاری', value: overview.activeCycles, icon: TrendingUp },
                  { label: 'در انتظار بررسی', value: overview.pendingReviews, icon: AlertCircle },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <Icon aria-hidden className="h-3 w-3" />
                        {item.label}
                      </p>
                      <p className="mt-1 text-xl font-extrabold tabular text-slate-900 dark:text-slate-100">{faDigits(item.value)}</p>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="آخرین نتایج منتشرشده"
          subtitle="نتایج نهایی دوره‌های بسته‌شده"
          icon={<Trophy aria-hidden className="h-4 w-4" />}
          actions={<LinkButton href="/results" variant="secondary" size="sm">همه نتایج</LinkButton>}
        />
        {!results || results.items.length === 0 ? (
          <EmptyState title="نتیجه‌ای منتشر نشده است" description="پس از انتشار نتایج، در این بخش نمایش داده می‌شوند." />
        ) : (
          <Table head={['کارمند', 'دوره', 'امتیاز نهایی', 'وضعیت']}>
            {results.items.slice(0, 5).map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <Td className="text-[13px] font-semibold">{r.employee.firstName} {r.employee.lastName}</Td>
                <Td className="text-xs">{r.cycle.name}</Td>
                <Td className="tabular text-[13px] font-bold">{formatScore(r.finalScore)}</Td>
                <Td><StatusBadge group="assignmentStatus" value={r.status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
