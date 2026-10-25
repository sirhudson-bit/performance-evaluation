import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, Alert, Badge } from '@/components/ui';
import { ComplianceForm } from '@/components/AdminForms';

interface ComplianceData { profile: Record<string, unknown> | null; missing: string[] }
interface Service { id: number; name: string; purpose: string; category: string; requiresConsent: boolean; isActive: boolean }
interface Asset { id: number; name: string; kind: string; license: string | null; verified: boolean }

const MISSING_LABELS: Record<string, string> = { legalName: 'نام حقوقی', country: 'کشور', contactEmail: 'ایمیل تماس', contactPhone: 'تلفن تماس' };

export default async function AdminCompliancePage() {
  const [compliance, thirdParty, assets] = await Promise.all([
    apiData<ComplianceData>('/admin/compliance'),
    apiData<{ items: Service[] }>('/admin/third-party'),
    apiData<{ items: Asset[] }>('/admin/assets'),
  ]);

  return (
    <>
      <PageHeader title="انطباق و حریم خصوصی" description="اطلاعات هویتی کسب‌وکار، سرویس‌های ثالث و دارایی‌ها" />

      {compliance && compliance.missing.length > 0 ? (
        <Alert variant="warning">
          موارد نیازمند تأیید کسب‌وکار: {compliance.missing.map((m) => MISSING_LABELS[m] ?? m).join('، ')} — تا تکمیل نشدن این موارد، اسناد حقوقی به‌صورت نیمه‌کاره علامت‌گذاری می‌شوند.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="اطلاعات هویتی کسب‌وکار" />
          <CardBody><ComplianceForm initial={compliance?.profile ?? {}} /></CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="سرویس‌های ثالث و ردیاب‌ها" subtitle="فقط سرویس‌های واقعیِ در حال استفاده" />
            {!thirdParty || thirdParty.items.length === 0 ? (
              <EmptyState title="سرویس ثالثی ثبت نشده است" description="به‌طور پیش‌فرض هیچ ابزار تحلیلی ثالثی بارگذاری نمی‌شود." />
            ) : (
              <Table head={['نام', 'هدف', 'دسته', 'رضایت لازم', 'فعال']}>
                {thirdParty.items.map((s) => (
                  <tr key={s.id}>
                    <Td>{s.name}</Td>
                    <Td className="text-xs">{s.purpose}</Td>
                    <Td>{s.category}</Td>
                    <Td>{s.requiresConsent ? <Badge tone="warning">بله</Badge> : <Badge tone="muted">خیر</Badge>}</Td>
                    <Td>{s.isActive ? <Badge tone="success">بله</Badge> : <Badge tone="muted">خیر</Badge>}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="فهرست دارایی‌ها و مجوزها" />
            {!assets || assets.items.length === 0 ? (
              <EmptyState title="دارایی‌ای ثبت نشده است" />
            ) : (
              <Table head={['نام', 'نوع', 'مجوز', 'تأیید‌شده']}>
                {assets.items.map((a) => (
                  <tr key={a.id}>
                    <Td>{a.name}</Td>
                    <Td>{a.kind}</Td>
                    <Td dir="ltr" className="text-xs">{a.license ?? '—'}</Td>
                    <Td>{a.verified ? <Badge tone="success">بله</Badge> : <Badge tone="warning">خیر</Badge>}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
