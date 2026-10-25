import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, EmptyState, Alert } from '@/components/ui';
import { ProcessForm, ProcessRow } from '@/components/ProcessForms';

interface Step { id: number; name: string; order: number; ownerType: string; ownerRoleKey: string | null; slaDays: number | null }
interface Dimension { id: number; name: string; weight: string; ownerRoleKey: string | null }
interface Proc { id: number; name: string; evaluationModel: string; status: string; version: number; targetGroups: unknown; steps: Step[]; dimensions: Dimension[]; _count: { cycles: number } }

export default async function AdminProcessesPage() {
  const user = await getSession();
  const canManage = hasPermission(user, 'processes.manage');
  const data = await apiData<{ items: Proc[] }>('/processes');
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="فرایندهای مدیریت عملکرد" description="طراحی فرایند، مراحل عملیاتی، افراد مسئول و ابعاد ارزیابی" />

      <div className="grid gap-6 lg:grid-cols-3">
        {canManage ? (
          <Card className="lg:col-span-1">
            <CardHeader title="فرایند جدید" />
            <CardBody><ProcessForm /></CardBody>
          </Card>
        ) : null}

        <Card className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader title="فرایندها" subtitle={`${items.length} فرایند`} />
          {items.length === 0 ? (
            <EmptyState title="فرایندی ثبت نشده است" description="یک فرایند بسازید و مراحل و ابعاد آن را تعیین کنید." />
          ) : (
            items.map((p) => <ProcessRow key={p.id} process={p} />)
          )}
        </Card>
      </div>

      {!canManage ? <Alert variant="info">برای ایجاد یا ویرایش فرایند به دسترسی مدیریتی نیاز دارید؛ نسخه فعلی فقط قابل مشاهده است.</Alert> : null}
    </>
  );
}
