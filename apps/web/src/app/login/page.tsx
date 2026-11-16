import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Gauge, ShieldCheck, Sparkles, Users2 } from 'lucide-react';
import { getSession } from '@/lib/api';
import { LoginForm } from '@/components/LoginForm';

const FEATURES = [
  { icon: ShieldCheck, title: 'دسترسی نقش‌محور', body: 'هر کاربر فقط بخش‌ها و داده‌های مجاز خود را می‌بیند.' },
  { icon: BarChart3, title: 'امتیازدهی شفاف', body: 'محاسبه وزن‌دار و قابل بازتولید با گزارش تفکیکی.' },
  { icon: Users2, title: 'گردش‌کار سازمانی', body: 'خودارزیابی، مدیر، منابع انسانی و انتشار نتیجه.' },
  { icon: Sparkles, title: 'دستیار هوشمند', body: 'پاسخ سریع به پرسش‌های قواعد و فرایندها.' },
];

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect('/dashboard');

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas dark:bg-slate-950">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-400/15 blur-3xl dark:bg-brand-500/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/5" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-xl shadow-brand-500/25">
              <Gauge aria-hidden className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-sm font-extrabold text-slate-900 dark:text-slate-100">سامانه ارزیابی عملکرد</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">نامیرا همراه پارس</span>
            </span>
          </Link>

          <h1 className="mt-12 text-4xl font-black leading-[1.35] tracking-tight text-slate-950 dark:text-slate-50">
            ارزیابی عملکرد،
            <span className="block bg-gradient-to-l from-brand-600 to-sky-500 bg-clip-text text-transparent">شفاف و قابل اعتماد.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-8 text-slate-600 dark:text-slate-300">
            دوره‌های ارزیابی، پرسش‌های وزن‌دار، گردش‌کار تأیید و گزارش‌های مدیریتی — یک سامانه یکپارچه، فارسی و راست‌به‌چپ.
          </p>

          <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-xs font-bold text-slate-900 dark:text-slate-100">{feature.title}</p>
                  <p className="mt-1 text-[11px] leading-6 text-slate-500 dark:text-slate-400">{feature.body}</p>
                </div>
              );
            })}
          </div>

          <p className="mt-8 flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
            ورود امن، نشست محافظت‌شده و کنترل دسترسی مبتنی بر مجوز
          </p>
        </section>

        <section className="w-full max-w-md justify-self-center">
          <Link href="/" className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-lg shadow-brand-500/25">
              <Gauge aria-hidden className="h-5 w-5" />
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">سامانه ارزیابی عملکرد</span>
          </Link>

          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/95">
            <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-[10px] font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
              ورود به حساب سازمانی
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">خوش آمدید</h1>
            <p className="mb-6 mt-1.5 text-xs leading-6 text-slate-500 dark:text-slate-400">
              برای ادامه، با ایمیل سازمانی و رمز عبور یا کد یک‌بار مصرف وارد شوید.
            </p>
            <LoginForm />
          </div>

          <p className="mt-5 text-center text-xs leading-6 text-slate-500 dark:text-slate-400">
            با ورود، <Link href="/terms" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800 dark:text-brand-300">شرایط استفاده</Link> و{' '}
            <Link href="/privacy" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800 dark:text-brand-300">سیاست حریم خصوصی</Link> را می‌پذیرید.
          </p>
        </section>
      </div>
    </main>
  );
}
