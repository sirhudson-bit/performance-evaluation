import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { getSession } from '@/lib/api';
import { LinkButton } from '@/components/ui';

const FEATURES = [
  {
    icon: Layers3,
    title: 'فرم‌ساز و پرسش وزن‌دار',
    body: 'پرسش‌های طیفی، گزینه‌ای، عددی و متنی را با وزن و امتیاز دلخواه بسازید و در فرم‌های چندبخشی بچینید.',
  },
  {
    icon: ClipboardCheck,
    title: 'گردش‌کار چندمرحله‌ای',
    body: 'خودارزیابی، ارزیابی مدیر، بازبینی منابع انسانی و انتشار نتیجه — با وضعیت شفاف در هر مرحله.',
  },
  {
    icon: BarChart3,
    title: 'گزارش و خروجی اکسل',
    body: 'توزیع امتیاز، میانگین واحدها و سمت‌ها، گزارش فردی و خروجی قابل دانلود برای تحلیل مدیریتی.',
  },
  {
    icon: ShieldCheck,
    title: 'دسترسی نقش‌محور',
    body: 'هر نقش دقیقاً همان بخش‌ها و داده‌هایی را می‌بیند که مجاز است؛ با ثبت رخداد و امکان حسابرسی.',
  },
  {
    icon: Smartphone,
    title: 'ورود امن و پیامک',
    body: 'ورود با رمز یا رمز یک‌بار مصرف، ارسال پیام سامانه‌ای و اطلاع‌رسانی خودکار به مدیران و کارکنان.',
  },
  {
    icon: Sparkles,
    title: 'دستیار هوشمند',
    body: 'پرسش‌های قواعد و فرایندها را بپرسید؛ دستیار با تکیه بر راهنمای همان سازمان پاسخ می‌دهد.',
  },
];

const STEPS = [
  { n: '۱', title: 'فرم و دوره را بسازید', body: 'پرسش‌ها، وزن‌ها و مراحل گردش‌کار را تعریف کنید و دوره ارزیابی را فعال کنید.' },
  { n: '۲', title: 'تیم ارزیابی را تکمیل می‌کند', body: 'کارکنان خودارزیابی می‌کنند و مدیران ارزیابی را در همان سامانه نهایی می‌کنند.' },
  { n: '۳', title: 'نتیجه را منتشر کنید', body: 'پس از بازبینی، نتیجه در پروفایل افراد و گزارش‌های مدیریتی منتشر می‌شود.' },
];

const STATS = [
  { value: '۴', label: 'مرحله گردش‌کار' },
  { value: '۱۰+', label: 'نوع پرسش' },
  { value: '۱۰۰٪', label: 'فارسی و راست‌به‌چپ' },
  { value: 'PWA', label: 'نصب روی موبایل' },
];

export default async function LandingPage() {
  const user = await getSession();
  const primaryHref = user ? '/dashboard' : '/login';
  const primaryLabel = user ? 'رفتن به داشبورد' : 'ورود به سامانه';

  return (
    <main className="min-h-screen overflow-x-clip bg-canvas text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-lg shadow-brand-500/20">
              <Gauge aria-hidden className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-slate-900 dark:text-slate-50">سامانه ارزیابی عملکرد</span>
              <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">نامیرا همراه پارس</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 md:flex" aria-label="بخش‌های معرفی">
            <a href="#features" className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">قابلیت‌ها</a>
            <a href="#how" className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">چطور کار می‌کند</a>
            <a href="#security" className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">امنیت و دسترسی</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {!user ? (
              <Link href="/forgot-password" className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white sm:block">
                بازیابی رمز
              </Link>
            ) : (
              <Link href="/help" className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white sm:block">
                راهنما
              </Link>
            )}
            <LinkButton href={primaryHref} size="sm">
              {primaryLabel}
              <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
            </LinkButton>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-brand-400/15 blur-3xl dark:bg-brand-500/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/5" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:pb-28 lg:pt-20">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/80 bg-brand-50/80 px-3 py-1 text-[10px] font-bold text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-200">
              <Sparkles aria-hidden className="h-3 w-3" />
              پلتفرم ارزیابی عملکرد سازمانی
            </span>

            <h1 className="mt-5 text-[2rem] font-black leading-[1.35] tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl lg:text-[3.35rem]">
              عملکرد تیم را
              <span className="block bg-gradient-to-l from-brand-600 via-brand-500 to-sky-500 bg-clip-text text-transparent">شفاف بسنجید.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
              از تعریف پرسش‌های وزن‌دار تا خودارزیابی، تأیید مدیر و انتشار نتیجه؛ همهٔ چرخهٔ ارزیابی در یک سامانهٔ فارسی، امن و قابل گزارش.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <LinkButton href={primaryHref} size="lg">
                {user ? 'رفتن به داشبورد' : 'شروع ارزیابی'}
                <ArrowLeft aria-hidden className="h-4 w-4" />
              </LinkButton>
              <a
                href="#features"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-white hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-brand-800"
              >
                مشاهده قابلیت‌ها
              </a>
            </div>

            <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {['دسترسی نقش‌محور', 'ورود با رمز یک‌بار مصرف', 'گزارش قابل حسابرسی'].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check aria-hidden className="h-2.5 w-2.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[35rem]">
            <div aria-hidden className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-brand-500/15 via-sky-400/10 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="mr-2 flex-1 rounded-md bg-white px-2 py-1 text-center text-[8px] text-slate-400 dark:bg-slate-900 dark:text-slate-500" dir="ltr">
                  app.namira.ir/dashboard
                </span>
              </div>

              <div className="flex min-h-[21rem]" dir="rtl">
                <aside className="hidden w-28 shrink-0 border-l border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40 sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
                      <Gauge aria-hidden className="h-3 w-3" />
                    </span>
                    <span className="text-[8px] font-extrabold text-slate-700 dark:text-slate-200">ارزیابی</span>
                  </div>
                  <div className="mt-4 space-y-1">
                    {['داشبورد', 'ارزیابی‌ها', 'نتایج', 'گزارش‌ها', 'کاربران'].map((label, index) => (
                      <div
                        key={label}
                        className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[8px] font-medium ${
                          index === 0
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        {label}
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="min-w-0 flex-1 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[8px] text-slate-400">داشبورد مدیر</p>
                      <p className="text-[11px] font-extrabold text-slate-900 dark:text-slate-50">سلام، مدیر سامانه</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[7px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      دوره فعال
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { label: 'در انتظار اقدام', value: '۴', tone: 'text-amber-600' },
                      { label: 'تکمیل‌شده', value: '۲۶', tone: 'text-emerald-600' },
                      { label: 'میانگین امتیاز', value: '۷۲٫۵', tone: 'text-brand-600' },
                      { label: 'نرخ تکمیل', value: '۸۴٪', tone: 'text-sky-600' },
                    ].map((kpi) => (
                      <div key={kpi.label} className="rounded-lg border border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/60">
                        <p className="text-[7px] text-slate-400">{kpi.label}</p>
                        <p className={`mt-0.5 text-sm font-black tabular ${kpi.tone}`}>{kpi.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 rounded-lg border border-slate-100 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between text-[7px] text-slate-500">
                      <span>پیشرفت دوره</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">۸۴٪</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div className="h-full w-[84%] rounded-full bg-gradient-to-l from-brand-500 to-sky-400" />
                    </div>
                  </div>

                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between bg-slate-50 px-2 py-1.5 text-[7px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <span>ارزیابی‌های در انتظار</span>
                      <span className="text-brand-600 dark:text-brand-300">مشاهده همه</span>
                    </div>
                    {[
                      ['برنامه‌نویس یک', 'در حال تکمیل', 'bg-amber-500'],
                      ['برنامه‌نویس دو', 'ارسال‌شده', 'bg-sky-500'],
                      ['کارشناس منابع انسانی', 'تأییدشده', 'bg-emerald-500'],
                    ].map(([name, status, dot]) => (
                      <div key={name} className="flex items-center justify-between border-t border-slate-100 px-2 py-1.5 dark:border-slate-700">
                        <span className="text-[7px] font-medium text-slate-700 dark:text-slate-200">{name}</span>
                        <span className="flex items-center gap-1 text-[7px] text-slate-500 dark:text-slate-400">
                          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 right-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 aria-hidden className="h-4 w-4" />
              </span>
              <span className="text-[9px] font-bold text-slate-700 dark:text-slate-200">نتایج با موفقیت منتشر شد</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white/60 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">{stat.value}</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[11px] font-bold text-brand-600 dark:text-brand-300">همه‌چیز در یک سامانه</span>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">از فرم‌سازی تا گزارش مدیریتی</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
            ماژول‌های به‌هم‌پیوسته‌ای که چرخهٔ ارزیابی را بدون فایل‌های پراکنده و جدول‌های دستی پیش می‌برند.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950/60 dark:text-brand-300">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[13px] font-extrabold text-slate-900 dark:text-slate-50">{feature.title}</h3>
                <p className="mt-2 text-[11px] leading-6 text-slate-500 dark:text-slate-400">{feature.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="how" className="scroll-mt-24 border-y border-slate-200/80 bg-white/50 py-20 dark:border-slate-800 dark:bg-slate-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-brand-600 dark:text-brand-300">در سه گام</span>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">چرخهٔ ارزیابی، ساده و مشخص</h2>
            </div>
            <p className="max-w-md text-xs leading-6 text-slate-500 dark:text-slate-400">
              هر گام وضعیت روشنی دارد؛ می‌دانید چه چیزی در انتظار چه کسی است و نتیجه چه زمانی منتشر می‌شود.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.n} className="relative rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                {index < STEPS.length - 1 ? (
                  <span aria-hidden className="absolute -left-3 top-10 hidden h-px w-6 bg-gradient-to-l from-brand-300 to-transparent md:block" />
                ) : null}
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white dark:bg-white dark:text-slate-900">
                  {step.n}
                </span>
                <h3 className="mt-4 text-[13px] font-extrabold text-slate-900 dark:text-slate-50">{step.title}</h3>
                <p className="mt-2 text-[11px] leading-6 text-slate-500 dark:text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-slate-900 to-brand-950 p-6 text-white shadow-2xl sm:p-10">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-white/80">
                <LockKeyhole aria-hidden className="h-3 w-3" />
                امنیت و کنترل دسترسی
              </span>
              <h2 className="mt-4 text-2xl font-black leading-[1.45] tracking-tight sm:text-3xl">داده‌های عملکرد، فقط در دسترس درست‌ترین افراد.</h2>
              <p className="mt-3 max-w-md text-xs leading-7 text-white/65">
                مجوزها در سرور بررسی می‌شوند، نشست‌ها قابل ابطال‌اند و هر اقدام حساس در گزارش رخدادها ثبت می‌شود.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['RBAC', 'Audit Log', 'OTP Login', 'Session Revocation'].map((item) => (
                  <span key={item} dir="ltr" className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold text-white/75">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="flex items-center gap-2 text-[11px] font-bold text-white/80">
                  <Users aria-hidden className="h-4 w-4" />
                  ماتریس دسترسی
                </span>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">فعال</span>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  ['مدیر سامانه', 'همه بخش‌ها', true],
                  ['مدیر مستقیم', 'تیم و ارزیابی‌ها', true],
                  ['کارمند', 'عملکرد شخصی', true],
                  ['مهمان', 'بدون دسترسی', false],
                ].map(([role, scope, allowed]) => (
                  <div key={role as string} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                    <div>
                      <p className="text-[10px] font-bold text-white/85">{role}</p>
                      <p className="text-[9px] text-white/45">{scope}</p>
                    </div>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${allowed ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                      {allowed ? <Check aria-hidden className="h-3 w-3" /> : <LockKeyhole aria-hidden className="h-2.5 w-2.5" />}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-5 rounded-3xl border border-brand-100 bg-brand-50/70 p-6 text-center sm:flex-row sm:text-right dark:border-brand-900 dark:bg-brand-950/30">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-slate-50">آمادهٔ شروع یک ارزیابی شفاف هستید؟</h2>
            <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">با حساب سازمانی وارد شوید و اولین دوره را در چند دقیقه بسازید.</p>
          </div>
          <LinkButton href={primaryHref} size="lg">
            {primaryLabel}
            <ArrowLeft aria-hidden className="h-4 w-4" />
          </LinkButton>
        </div>
      </section>

      <footer className="border-t border-slate-200/80 bg-white/60 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-[11px] text-slate-500 dark:text-slate-400 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Gauge aria-hidden className="h-4 w-4" />
            </span>
            <span>سامانه ارزیابی عملکرد · نامیرا همراه پارس</span>
          </div>
          <nav className="flex flex-wrap items-center gap-4" aria-label="پیوندهای حقوقی">
            <Link href="/privacy" className="hover:text-brand-700 dark:hover:text-brand-300">حریم خصوصی</Link>
            <Link href="/terms" className="hover:text-brand-700 dark:hover:text-brand-300">شرایط استفاده</Link>
            <Link href="/cookies" className="hover:text-brand-700 dark:hover:text-brand-300">کوکی‌ها</Link>
            <Link href={primaryHref} className="font-bold text-brand-700 hover:underline dark:text-brand-300">{primaryLabel}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
