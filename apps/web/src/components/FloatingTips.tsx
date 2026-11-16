'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

/**
 * Small, user-invoked help chip.
 *
 * Earlier this component auto-opened a fixed card 2.5 seconds after login and
 * covered form controls at the bottom of the page. It now stays collapsed as a
 * compact pill; the rotating tips are only shown after the user asks for them.
 */
const TIPS = [
  'برای دیدن راهنمای گام‌به‌گام هر بخش، از صفحه «راهنما» تور آموزشی را اجرا کنید.',
  'ارزیابی ناتمام را می‌توانید «ذخیره پیش‌نویس» کنید و بعداً ادامه دهید.',
  'برای پرسش‌های بی‌ربط، گزینه «مصداق ندارد» را انتخاب کنید تا در امتیاز اثر نگذارد.',
  'با دکمه خورشید/ماه در نوار بالا بین حالت روشن و تیره جابه‌جا شوید.',
  'برای ارتباط با پشتیبانی، از بخش «پیام‌ها و تیکت‌ها» استفاده کنید.',
  'خروجی اکسل گزارش‌ها در پس‌زمینه ساخته می‌شود و پس از آماده‌شدن قابل دانلود است.',
];

const STORAGE_KEY = 'pe_tips_dismissed';

export function FloatingTips() {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      setHidden(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const rotate = setInterval(() => setIndex((i) => (i + 1) % TIPS.length), 12000);
    return () => clearInterval(rotate);
  }, [open]);

  if (!mounted || hidden) return null;

  function dismiss() {
    setOpen(false);
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 sm:bottom-5 sm:left-5">
      {open ? (
        <div className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="status">
          <div className="flex items-start gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
              <Lightbulb aria-hidden className="h-4 w-4" />
            </span>
            <p className="flex-1 text-xs leading-6 text-slate-700 dark:text-slate-200">{TIPS[index]}</p>
            <button onClick={dismiss} aria-label="بستن راهنما" className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-lg transition hover:-translate-y-0.5 hover:border-brand-200 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-800"
        >
          <Lightbulb aria-hidden className="h-4 w-4 text-amber-500" />
          نکته
        </button>
      )}
    </div>
  );
}
