import Link from 'next/link';
import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge, Alert, Badge } from '@/components/ui';
import { CycleForm, ActionButton } from '@/components/AdminForms';
import { formatJalali } from '@/lib/format';

interface Cycle { id: number; name: string; status: string; startDate: string; endDate: string; selfAssessment: boolean; appealEnabled: boolean; _count: { assignments: number; results: number } }
interface Form { id: number; name: string; versions: { id: number; version: number; status: string }[] }

export default async function AdminCyclesPage() {
  const [cycles, forms] = await Promise.all([
    apiData<{ items: Cycle[] }>('/evaluation-cycles'),
    apiData<{ items: Form[] }>('/forms'),
  ]);

  const publishedVersions = (forms?.items ?? []).flatMap((f) =>
    f.versions.filter((v) => v.status === 'published').map((v) => ({ id: v.id, label: `${f.name} — v${v.version}` })),
  );

  return (
    <>
      <PageHeader title="دوره‌های ارزیابی" description="ایجاد و مدیریت دوره‌ها و گردش‌کار" />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="دوره جدید" />
          <CardBody>
            {publishedVersions.length === 0 ? (
              <Alert variant="warning">ابتدا یک نسخه فرم را در بخش «فرم‌ها» منتشر کنید.</Alert>
            ) : (
              <CycleForm formVersions={publishedVersions} />
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="دوره‌ها" subtitle={`${cycles?.items.length ?? 0} دوره`} />
          {!cycles || cycles.items.length === 0 ? (
            <EmptyState title="دوره‌ای ثبت نشده است" />
          ) : (
            <Table head={['نام', 'بازه', 'وضعیت', 'ارجاع‌ها', '']}>
              {cycles.items.map((c) => (
                <tr key={c.id}>
                  <Td>
                    {c.name}
                    <div className="mt-1 flex gap-1">
                      {c.selfAssessment ? <Badge tone="muted">خودارزیابی</Badge> : null}
                      {c.appealEnabled ? <Badge tone="muted">اعتراض</Badge> : null}
                    </div>
                  </Td>
                  <Td className="text-xs">{formatJalali(c.startDate)} – {formatJalali(c.endDate)}</Td>
                  <Td><StatusBadge group="cycleStatus" value={c.status} /></Td>
                  <Td className="tabular">{c._count.assignments}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1">
                      <Link href={`/admin/cycles`} className="text-xs text-brand-700 hover:underline">جزئیات</Link>
                      {c.status === 'draft' ? <ActionButton method="POST" path={`/evaluation-cycles/${c.id}/status`} body={{ status: 'active' }} label="فعال‌سازی" variant="primary" /> : null}
                      {['active', 'in_review'].includes(c.status) ? <ActionButton method="POST" path={`/evaluation-cycles/${c.id}/status`} body={{ status: 'in_review' }} label="بازبینی" /> : null}
                      {['active', 'in_review'].includes(c.status) ? <ActionButton method="POST" path={`/evaluation-cycles/${c.id}/status`} body={{ status: 'closed' }} label="بستن" variant="danger" confirm="بستن دوره؟ تاریخچه حفظ می‌شود." /> : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
