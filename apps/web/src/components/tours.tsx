'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

/**
 * Guided tours. Each step optionally targets a real element via `[data-tour="…"]`;
 * a step whose target is absent is shown centred instead of pointing at nothing.
 * Keyboard operable (Esc closes, Arrow keys navigate) and reduced-motion aware.
 */
export interface TourStep {
  selector?: string;
  title: string;
  body: string;
}
export interface TourDef {
  id: string;
  label: string;
  steps: TourStep[];
}

export const TOURS: TourDef[] = [
  {
    id: 'onboarding',
    label: 'آشنایی با محیط',
    steps: [
      { title: 'خوش آمدید', body: 'این تور کوتاه، بخش‌های اصلی سامانه را به شما معرفی می‌کند. با «بعدی» ادامه دهید و هر زمان می‌توانید ببندید.' },
      { selector: '[data-tour="sidebar"]', title: 'منوی اصلی', body: 'بخش‌های «کارهای من» و «مدیریت» در این منو قرار دارند. دسترسی‌ها بر پایه نقش شما نمایش داده می‌شود.' },
      { selector: '[data-tour="theme"]', title: 'حالت روشن/تیره', body: 'با این دکمه پوسته را تغییر دهید؛ انتخاب شما ذخیره می‌شود.' },
      { selector: '[data-tour="help"]', title: 'راهنما و تورها', body: 'در صفحه راهنما، راهنمای گام‌به‌گام و تور آموزشی هر بخش در دسترس است.' },
    ],
  },
  {
    id: 'navigation',
    label: 'کارها: ارزیابی، نتایج، تیکت',
    steps: [
      { selector: '[data-tour="nav-/evaluations"]', title: 'ارزیابی‌های من', body: 'ارزیابی‌های ارجاع‌شده به شما اینجاست؛ باز کنید، پاسخ دهید، پیش‌نویس ذخیره کنید و در پایان ارسال نهایی بزنید.' },
      { selector: '[data-tour="nav-/results"]', title: 'نتایج', body: 'پس از انتشار، نتیجه نهایی و تفکیک بخش‌ها از این بخش قابل مشاهده است.' },
      { selector: '[data-tour="nav-/tickets"]', title: 'پیام‌ها و تیکت‌ها', body: 'برای ارتباط با پشتیبانی، درخواست ثبت کنید و گفت‌وگو را ادامه دهید.' },
    ],
  },
  {
    id: 'questions',
    label: 'مدیریت: بانک پرسش و فرم',
    steps: [
      { selector: '[data-tour="nav-/admin/questions"]', title: 'بانک پرسش‌ها', body: 'پرسش بسازید، نوع پاسخ و وزن را تعیین کنید؛ هر ویرایش یک نسخه جدید می‌سازد.' },
      { selector: '[data-tour="nav-/admin/forms"]', title: 'فرم‌ها و نسخه‌ها', body: 'فرم بسازید، نسخه جدید بگیرید، منتشر یا حذف کنید. نسخه منتشرشده تغییرناپذیر است.' },
    ],
  },
  {
    id: 'cycles',
    label: 'مدیریت: دوره‌ها و انتشار',
    steps: [
      { selector: '[data-tour="nav-/admin/cycles"]', title: 'دوره‌های ارزیابی', body: 'دوره بسازید، فعال کنید، ارزیابان را ارجاع دهید و پس از تکمیل، نتایج را منتشر کنید.' },
      { selector: '[data-tour="nav-/admin/roles"]', title: 'نقش‌ها', body: 'نقش سفارشی بسازید و دسترسی‌ها را از کاتالوگ انتخاب کنید.' },
    ],
  },
  {
    id: 'org-users',
    label: 'مدیریت: سازمان، کاربران، تنظیمات',
    steps: [
      { selector: '[data-tour="nav-/admin/organization"]', title: 'ساختار سازمانی', body: 'واحدها (حسابداری، انبار، بازاریابی، …) و عنوان‌های شغلی را بسازید و ویرایش کنید.' },
      { selector: '[data-tour="nav-/admin/users"]', title: 'کاربران', body: 'حساب بسازید و دپارتمان/واحد کاری، نقش و وضعیت را تعیین کنید.' },
      { selector: '[data-tour="nav-/admin/settings"]', title: 'تنظیمات و PWA', body: 'نام سامانه، پوسته پیش‌فرض و مشخصات اپلیکیشن نصب‌شو اینجا تنظیم می‌شود.' },
    ],
  },
  {
    id: 'reports-ai',
    label: 'گزارش‌ها و دستیار هوشمند',
    steps: [
      { selector: '[data-tour="nav-/reports"]', title: 'گزارش‌ها', body: 'خروجی اکسل بگیرید و نمودارهای توزیع امتیاز و وضعیت تکمیل را ببینید.' },
      { selector: '[data-tour="nav-/assistant"]', title: 'دستیار هوشمند', body: 'درباره قواعد سامانه بپرسید. پاسخ‌ها ممکن است نادرست باشند و تصمیم‌گیرنده نیستند.' },
    ],
  },
];

function useTargetRect(selector?: string): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    const t = setInterval(update, 500);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      clearInterval(t);
    };
  }, [selector]);
  return rect;
}

export function GuidedTour({ tour, onClose }: { tour: TourDef; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = tour.steps[step];
  const rect = useTargetRect(current?.selector);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setStep((s) => Math.min(tour.steps.length - 1, s + 1));
      if (e.key === 'ArrowRight') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, onClose]);

  if (!current) return null;

  const isLast = step === tour.steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`تور آموزشی: ${tour.label}`}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded ring-2 ring-brand-500"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
          aria-hidden
        />
      ) : null}
      <div className="absolute bottom-6 left-1/2 w-[min(92vw,26rem)] -translate-x-1/2 rounded border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{current.title}</p>
          <button onClick={onClose} aria-label="بستن تور" className="text-slate-400 hover:text-slate-600">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{current.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-400">گام {step + 1} از {tour.steps.length}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowRight aria-hidden className="h-4 w-4" /> قبلی
            </Button>
            {isLast ? (
              <Button onClick={onClose}>پایان</Button>
            ) : (
              <Button onClick={() => setStep((s) => Math.min(tour.steps.length - 1, s + 1))}>
                بعدی <ArrowLeft aria-hidden className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Buttons to start any tour (used on the help page). */
export function TourLauncher() {
  const [active, setActive] = useState<TourDef | null>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TOURS.map((t) => (
          <Button key={t.id} variant="secondary" onClick={() => setActive(t)}>
            {t.label}
          </Button>
        ))}
      </div>
      {active ? <GuidedTour tour={active} onClose={() => setActive(null)} /> : null}
    </div>
  );
}

/** Auto-starts the onboarding tour once per browser. */
export function OnboardingTour() {
  const [tour, setTour] = useState<TourDef | null>(null);
  useEffect(() => {
    try {
      if (localStorage.getItem('pe_onboarding_done') === '1') return;
    } catch {
      return;
    }
    const t = TOURS.find((x) => x.id === 'onboarding') ?? null;
    const timer = setTimeout(() => setTour(t), 1200);
    return () => clearTimeout(timer);
  }, []);
  if (!tour) return null;
  return (
    <GuidedTour
      tour={tour}
      onClose={() => {
        setTour(null);
        try {
          localStorage.setItem('pe_onboarding_done', '1');
        } catch {
          /* ignore */
        }
      }}
    />
  );
}
