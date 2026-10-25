import type { Metadata } from 'next';
import { LegalShell, BusinessField } from '@/components/LegalShell';

export const metadata: Metadata = { title: 'شرایط استفاده' };

export default function TermsPage() {
  return (
    <LegalShell title="شرایط استفاده" version="1.0">
      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">۱. طرفین</h2>
        <p>
          ارائه‌دهنده سرویس: <BusinessField label="نام حقوقی ارائه‌دهنده" />. این سامانه یک ابزار سازمانی برای ارزیابی
          عملکرد کارکنان است و دسترسی به آن تنها برای کاربران مجاز سازمان در نظر گرفته شده است.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">۲. حساب‌ها و دسترسی</h2>
        <p>
          ایجاد و مدیریت حساب‌ها توسط مدیران سامانه انجام می‌شود. کاربر مسئول حفظ محرمانگی رمز عبور خود است. هرگونه
          استفاده غیرمجاز باید فوراً گزارش شود.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">۳. استفاده مجاز</h2>
        <p>
          استفاده از سامانه تنها برای اهداف سازمانیِ تعیین‌شده مجاز است. تلاش برای دسترسی غیرمجاز، تغییر داده‌های
          دیگران، یا دور زدن کنترل‌های دسترسی ممنوع است.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">۴. مالکیت محتوا</h2>
        <p>
          داده‌های سازمانی و پاسخ‌های ارزیابی متعلق به سازمان بهره‌بردار است. نرم‌افزار و اجزای آن تابع مجوزهای پکیج‌های
          استفاده‌شده است که در «فهرست دارایی‌ها و مجوزها» ثبت شده‌اند.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">۵. در دسترس بودن و تغییرات</h2>
        <p>
          سامانه ممکن است برای نگهداری یا به‌روزرسانی به‌طور موقت در دسترس نباشد. تغییرات این شرایط با نسخه‌گذاری اعلام
          می‌شود.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">۶. مسائل حل‌نشده</h2>
        <p>
          قانون حاکم، مرجع صالح و شرایط خدمات تجاری (در صورت وجود) باید بر اساس واقعیت کسب‌وکار تعیین شوند:{' '}
          <BusinessField label="قانون حاکم و مرجع صالح" />. تا زمان تأیید، هیچ شرط دلبخواهی در این سند درج نشده است.
        </p>
        <p>تماس: <BusinessField label="ایمیل تماس" /></p>
      </section>
    </LegalShell>
  );
}
