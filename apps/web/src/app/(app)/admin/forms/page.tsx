import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge, Alert } from '@/components/ui';
import { ActionButton, FormCreateForm } from '@/components/AdminForms';
import { formatJalali } from '@/lib/format';

interface Version { id: number; version: number; status: string; publishedAt: string | null }
interface Form { id: number; name: string; status: string; currentVersion: number | null; versions: Version[] }

export default async function AdminFormsPage() {
  const data = await apiData<{ items: Form[] }>('/forms');
  const forms = data?.items ?? [];

  return (
    <>
      <PageHeader title="فرم‌ها و نسخه‌ها" description="ایجاد، ویرایش، انتشار و حذف فرم‌ها" />
      <Alert variant="info">نسخه منتشرشده تغییرناپذیر است؛ برای تغییر، نسخه جدید بسازید. فرم استفاده‌شده در دوره بایگانی می‌شود تا تاریخچه حفظ گردد.</Alert>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="فرم جدید" />
          <CardBody><FormCreateForm /></CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {forms.length === 0 ? (
            <Card><EmptyState title="فرمی ثبت نشده است" /></Card>
          ) : (
            forms.map((f) => (
              <Card key={f.id}>
                <CardHeader
                  title={f.name}
                  subtitle={`نسخه جاری: ${f.currentVersion ?? '—'}`}
                  actions={
                    <div className="flex items-center gap-2">
                      <StatusBadge group="formStatus" value={f.status} />
                      <ActionButton method="POST" path={`/forms/${f.id}/versions`} label="نسخه جدید" variant="secondary" />
                      <ActionButton method="DELETE" path={`/forms/${f.id}`} label="حذف" variant="danger" confirm="این فرم حذف/بایگانی شود؟" />
                    </div>
                  }
                />
                <Table head={['نسخه', 'وضعیت', 'تاریخ انتشار', '']}>
                  {f.versions.map((v) => (
                    <tr key={v.id}>
                      <Td className="tabular">v{v.version}</Td>
                      <Td><StatusBadge group="formVersionStatus" value={v.status} /></Td>
                      <Td>{formatJalali(v.publishedAt)}</Td>
                      <Td>
                        {v.status !== 'published' ? (
                          <ActionButton method="POST" path={`/forms/versions/${v.id}/publish`} label="انتشار" variant="primary" confirm="از انتشار این نسخه مطمئن هستید؟ پس از انتشار قابل ویرایش نیست." />
                        ) : (
                          <span className="text-xs text-slate-400">منتشرشده</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </Table>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
