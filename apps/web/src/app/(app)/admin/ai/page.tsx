import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, Alert, Badge } from '@/components/ui';
import { AiProviderForm, AiUseCaseToggle } from '@/components/AdminForms';
import { AiProviderActions } from '@/components/AiForms';

interface Provider { id: number; name: string; type: string; baseUrl: string | null; hasApiKey: boolean; enabled: boolean; isDefault: boolean; isFallback: boolean; models: { id: number; modelId: string; enabled: boolean }[] }
interface UseCase { feature: string; enabled: boolean; dataCategories: string[] }

export default async function AdminAiPage() {
  const [providers, useCases, usage] = await Promise.all([
    apiData<{ items: Provider[]; suggestedBaseUrl: string }>('/ai/providers'),
    apiData<{ items: UseCase[] }>('/ai/use-cases'),
    apiData<{ totals: { requests: number; errors: number; tokens: number } }>('/ai/usage'),
  ]);

  const chatPolicy = useCases?.items.find((u) => u.feature === 'chat');

  return (
    <>
      <PageHeader title="مدیریت هوش مصنوعی" description="پیکربندی سرویس‌ها، مدل‌ها و سیاست‌های کاربرد" />

      <Alert variant="info">
        کلیدها فقط در سرور و به‌صورت رمزنگاری‌شده نگهداری می‌شوند و هرگز به مرورگر فرستاده نمی‌شوند. سرویس GapGPT پیشنهاد می‌شود اما پشتیبانی از نقاط پایانی/مدل‌ها تضمین‌شده نیست و باید بررسی شود.
      </Alert>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="افزودن سرویس" />
          <CardBody><AiProviderForm /></CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="سرویس‌های تنظیم‌شده" subtitle={`آدرس پیشنهادی: ${providers?.suggestedBaseUrl ?? '—'}`} />
            {!providers || providers.items.length === 0 ? (
              <EmptyState title="سرویسی تنظیم نشده است" description="سامانه بدون سرویس هوش مصنوعی نیز کامل کار می‌کند." />
            ) : (
              <Table head={['نام', 'نوع', 'آدرس', 'مدل‌ها', 'کلید', 'وضعیت', 'عملیات']}>
                {providers.items.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td dir="ltr" className="text-xs">{p.type}</Td>
                    <Td dir="ltr" className="text-xs">{p.baseUrl ?? '—'}</Td>
                    <Td className="tabular">{p.models.length}</Td>
                    <Td>{p.hasApiKey ? <Badge tone="success">تنظیم‌شده</Badge> : <Badge tone="muted">ندارد</Badge>}</Td>
                    <Td>{p.enabled ? <Badge tone="success">فعال</Badge> : <Badge tone="muted">غیرفعال</Badge>}</Td>
                    <Td><AiProviderActions provider={p} /></Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="سیاست کاربرد «گفت‌وگو»" subtitle="دسته‌های داده‌ای که مجاز به ارسال هستند" />
            <CardBody>
              <AiUseCaseToggle feature="chat" enabled={chatPolicy?.enabled ?? false} dataCategories={chatPolicy?.dataCategories ?? []} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="مصرف" />
            <CardBody className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-slate-500">درخواست‌ها</p><p className="text-lg font-bold tabular">{usage?.totals.requests ?? 0}</p></div>
              <div><p className="text-slate-500">خطاها</p><p className="text-lg font-bold tabular">{usage?.totals.errors ?? 0}</p></div>
              <div><p className="text-slate-500">توکن‌ها</p><p className="text-lg font-bold tabular">{usage?.totals.tokens ?? 0}</p></div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
