import { apiData } from '@/lib/api';
import { PageHeader, Card, CardBody, Alert } from '@/components/ui';
import { AssistantChat } from '@/components/AssistantChat';

export default async function AssistantPage() {
  const status = await apiData<{ enabled: boolean; configured: boolean; providerName: string | null }>('/ai/status');

  return (
    <>
      <PageHeader title="دستیار هوشمند" description="پرسش‌های خود را درباره سامانه و فرایند ارزیابی بپرسید" />

      {!status?.enabled || !status?.configured ? (
        <Alert variant="warning">
          دستیار هوشمند در حال حاضر غیرفعال است. برای فعال‌سازی، مدیر سامانه باید در بخش «مدیریت هوش مصنوعی» یک سرویس را تنظیم و کاربرد «گفت‌وگو» را فعال کند. سایر بخش‌های سامانه مستقل از این سرویس کار می‌کنند.
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <AssistantChat enabled={Boolean(status?.enabled && status?.configured)} providerName={status?.providerName ?? null} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800 dark:text-slate-200">نکته‌های مهم</p>
            <p>پاسخ‌ها توسط هوش مصنوعی تولید می‌شوند و ممکن است نادرست باشند.</p>
            <p>دستیار هرگز درباره امتیاز، ارتقا یا حقوق تصمیم نمی‌گیرد؛ فقط قواعد را توضیح می‌دهد.</p>
            <p>پیش‌فرض: هیچ داده ارزیابی شخصی برای سرویس بیرونی ارسال نمی‌شود.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
