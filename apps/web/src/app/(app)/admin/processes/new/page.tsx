import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardBody, Alert, LinkButton } from '@/components/ui';
import { ProcessWizard } from '@/components/ProcessWizard';

interface Unit { id: number; name: string; code: string | null }
interface Role { id: number; key: string; name: string; isProtected: boolean }

export default async function NewProcessPage() {
  const user = await getSession();
  if (!hasPermission(user, 'processes.manage')) {
    return <Alert variant="danger">برای ساخت فرایند به دسترسی مدیریتی نیاز دارید.</Alert>;
  }

  const [units, roles] = await Promise.all([
    apiData<{ items: Unit[] }>('/organization/units'),
    apiData<{ items: Role[] }>('/roles'),
  ]);

  return (
    <>
      <PageHeader
        title="فرایند جدید"
        description="در چهار قدم: اطلاعات پایه، مراحل اجرا، ابعاد ارزیابی و بازبینی. در هر لحظه می‌توانید به قدم قبل برگردید."
        actions={<LinkButton href="/admin/processes" variant="secondary">بازگشت به فهرست</LinkButton>}
      />
      <Card>
        <CardBody>
          <ProcessWizard
            units={(units?.items ?? []).map((u) => ({ id: u.id, name: u.name, code: u.code }))}
            roles={(roles?.items ?? []).filter((r) => !r.isProtected).map((r) => ({ key: r.key, name: r.name }))}
          />
        </CardBody>
      </Card>
    </>
  );
}
