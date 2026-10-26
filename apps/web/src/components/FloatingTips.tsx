'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

/**
 * Floating reminders / tips shown inside the app. Dismissible, rotating, and
 * persisted per browser so a dismissed tip does not reappear.
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
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    const timer = setTimeout(() => setVisible(true), 2500);
    const rotate = setInterval(() => setIndex((i) => (i + 1) % TIPS.length), 12000);
    return () => {
      clearTimeout(timer);
      clearInterval(rotate);
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-4 z-40 sm:inset-x-auto sm:left-4 sm:max-w-xs">
      <div className="flex items-start gap-2 rounded border border-brand-200 bg-white p-3 shadow-card dark:border-brand-900 dark:bg-slate-900" role="status">
        <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
        <p className="text-xs leading-6 text-slate-700 dark:text-slate-200">{TIPS[index]}</p>
        <button onClick={dismiss} aria-label="بستن راهنما" className="text-slate-400 hover:text-slate-600">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
