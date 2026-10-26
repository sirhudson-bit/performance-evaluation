import { apiData } from '@/lib/api';
import { Alert, PageHeader } from '@/components/ui';
import { SmsComposer, SmsLogs, SmsSettingsForm, type Recipient, type SmsLogRow, type SmsSettingsView } from '@/components/SmsPanel';

export default async function AdminSmsPage() {
  const [settings, recipients, logs] = await Promise.all([
    apiData<{ settings: SmsSettingsView }>('/admin/sms/settings'),
    apiData<{ items: Recipient[] }>('/admin/sms/recipients'),
    apiData<{ items: SmsLogRow[] }>('/admin/sms/logs?perPage=30'),
  ]);

  if (!settings) {
    return (
      <>
        <PageHeader title="پیامک" description="اتصال پنل پیامکی و ارسال پیام به کاربران" />
        <Alert variant="danger">برای مدیریت پیامک به دسترسی «مدیریت تنظیمات» نیاز دارید.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="پیامک و اطلاع‌رسانی" description="اتصال پنل ملی پیامک، ورود با رمز یک‌بار مصرف و ارسال پیام به مدیران و کاربران" />

      <Alert variant="info">
        رمز پنل پیامک فقط در سرور و به‌صورت رمزنگاری‌شده ذخیره می‌شود و هرگز به مرورگر برنمی‌گردد. برای فعال‌شدن ارسال، نام کاربری، رمز، خط ارسال و گزینه «فعال» لازم است.
      </Alert>

      <div className="mt-6 space-y-6">
        <SmsSettingsForm initial={settings.settings} />
        <SmsComposer recipients={recipients?.items ?? []} />
        <SmsLogs rows={logs?.items ?? []} />
      </div>
    </>
  );
}
