import type { Metadata } from 'next';
import { LegalShell, BusinessField } from '@/components/LegalShell';

export const metadata: Metadata = { title: 'سیاست کوکی‌ها' };

export default function CookiesPage() {
  return (
    <LegalShell title="سیاست کوکی‌ها" version="1.0">
      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">کوکی‌های ضروری</h2>
        <p>این سامانه به‌طور پیش‌فرض فقط از کوکی‌های ضروریِ نخست‌شخص استفاده می‌کند:</p>
        <ul className="list-disc space-y-1 pr-5">
          <li><b>pe_session</b> — نگهداری نشست ورود (HttpOnly، SameSite=Lax، در محیط عملیاتی Secure). بدون آن ورود ممکن نیست.</li>
          <li><b>pe_csrf</b> — نشانه محافظت در برابر جعل درخواست (خواندنی توسط کلاینت تا در هدر بازگردانده شود).</li>
        </ul>
        <p className="mt-2">این کوکی‌ها برای عملکرد ضروری‌اند و مشمول رضایت اختیاری نیستند.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">ابزارهای تحلیلی و تبلیغاتی</h2>
        <p>
          به‌طور پیش‌فرض هیچ ابزار تحلیلی، ردیاب یا تبلیغاتیِ ثالثی در سامانه بارگذاری نمی‌شود. اگر سازمانی این ابزارها را
          اضافه کند، تنها پس از کسب رضایت پیشین و از طریق سامانه رضایت فعال خواهند شد. سرویس‌های واقعیِ در حال استفاده در
          «فهرست سرویس‌های ثالث» پنل مدیریت ثبت می‌شوند.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">رضایت و تغییر آن</h2>
        <p>
          دسته‌های اختیاری به‌صورت پیش‌فرض انتخاب‌نشده‌اند و کاربر می‌تواند هر زمان رضایت خود را تغییر یا لغو کند. انتخاب
          کاربر ذخیره می‌شود. کوکی‌های ضروری بدون رضایت نیز در دسترس می‌مانند.
        </p>
        <p>مسئول سرویس: <BusinessField label="نام حقوقی سازمان" /></p>
      </section>
    </LegalShell>
  );
}
