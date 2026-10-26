import Link from 'next/link';
import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Alert } from '@/components/ui';
import { SettingsForm } from '@/components/AdminForms';

export default async function AdminSettingsPage() {
  const data = await apiData<{ settings: Record<string, string> }>('/admin/settings');

  return (
    <>
      <PageHeader title="تنظیمات سامانه" description="تنظیمات عمومی که با تغییر در پیکربندی ذخیره می‌شوند" />

      <Alert variant="info">
        هیچ کلید API یا رمزی در این بخش نمایش داده نمی‌شود؛ کلید سرویس هوش مصنوعی فقط در بخش «هوش مصنوعی» و به‌صورت نوشتنی قابل تنظیم است.
      </Alert>

      <Card className="mt-4">
        <CardHeader
          title="اتصال پنل پیامکی (ملی پیامک)"
          subtitle="ارسال پیامک سامانه، ورود با رمز یک‌بار مصرف و ارسال پیام به مدیران و کارکنان"
          actions={
            <Link href="/admin/sms" className="rounded bg-brand-700 px-3 py-2 text-sm text-white hover:bg-brand-800">
              تنظیم اتصال و ارسال پیام
            </Link>
          }
        />
        <CardBody className="text-sm text-slate-600 dark:text-slate-300">
          <p>
            برای فعال‌سازی ورود با رمز یک‌بار مصرف و ارسال پیام، نام کاربری، رمز، خط ارسال و شناسه الگوی خدماتی (اختیاری) را در صفحه پیامک وارد کنید.
            رمز پنل رمزنگاری‌شده ذخیره می‌شود و در این صفحه نمایش داده نمی‌شود.
          </p>
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SettingsForm initial={data?.settings ?? {}} />
        </div>

        <Card className="xl:col-span-1">
          <CardHeader title="وضعیت سرویس‌های اختیاری" />
          <CardBody className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>• ایمیل تراکنشی (SMTP): در صورت تنظیم‌نشدن، پیام‌ها فقط در گزارش سرور ثبت می‌شوند و رابط کاربری این وضعیت را صادقانه نشان می‌دهد.</p>
            <p>• صف پس‌زمینه: به‌صورت پیش‌فرض با میزکار (worker) و پایگاه داده کار می‌کند و به Redis نیاز ندارد.</p>
            <p>• هوش مصنوعی: در بخش «مدیریت هوش مصنوعی» پیکربندی می‌شود؛ سامانه بدون آن هم کامل کار می‌کند.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
