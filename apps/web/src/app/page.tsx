import Link from 'next/link';
import { getSession } from '@/lib/api';
import { LinkButton } from '@/components/ui';

/**
 * Public landing page. Always visible at `/` — a signed-in visitor still sees
 * it and is offered a direct link into the dashboard (never bounced away).
 */
export default async function LandingPage() {
  const user = await getSession();

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="mb-3 inline-block rounded border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
          سامانه سازمانی
        </p>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl dark:text-slate-100">سامانه ارزیابی عملکرد کارکنان</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300">
          طراحی و اجرای دوره‌های ارزیابی، امتیازدهی وزن‌دار و شفاف، گردش‌کار تأیید و انتشار نتایج، گزارش‌های اکسل و دستیار هوشمند — یکپارچه، فارسی و راست‌به‌چپ.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          {user ? (
            <>
              <LinkButton href="/dashboard">رفتن به داشبورد</LinkButton>
              <Link href="/help" className="rounded px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                راهنما و تورها
              </Link>
            </>
          ) : (
            <>
              <LinkButton href="/login">ورود به سامانه</LinkButton>
              <Link href="/help" className="rounded px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                راهنما
              </Link>
            </>
          )}
        </div>

        <div className="mt-16 grid gap-4 text-right sm:grid-cols-2 lg:grid-cols-3">
          {[
            { t: 'امتیازدهی شفاف', d: 'محاسبه وزن‌دار در سرور، با تفکیک کامل و قابل بازتولید.' },
            { t: 'گردش‌کار قابل تنظیم', d: 'خودارزیابی، مدیر، بررسی منابع انسانی و انتشار.' },
            { t: 'گزارش‌ها و نمودار', d: 'خروجی اکسل و نمودار توزیع امتیاز و وضعیت تکمیل.' },
            { t: 'پیام‌ها و تیکت', d: 'ارتباط مستقیم با پشتیبانی و پیگیری درخواست‌ها.' },
            { t: 'حالت روشن/تیره', d: 'پوسته دلخواه کاربر، ذخیره‌شده روی دستگاه.' },
            { t: 'نصب‌شو (PWA)', d: 'نصب روی موبایل و دسکتاپ با پشتیبانی آفلاین.' },
          ].map((f) => (
            <div key={f.t} className="rounded border border-slate-200 bg-surface p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{f.t}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{f.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-slate-400">
          {user ? 'شما وارد شده‌اید؛ از دکمه بالا مستقیماً به داشبورد بروید.' : 'پس از ورود، به‌طور خودکار به داشبورد منتقل می‌شوید.'}
        </p>
      </div>
    </main>
  );
}
