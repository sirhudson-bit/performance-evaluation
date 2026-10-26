import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, EmptyState } from '@/components/ui';
import { AgreementForm, AgreementCard, type Agreement } from '@/components/AgreementForms';

interface Employee { id: number; firstName: string; lastName: string; employeeNo: string }
interface Cycle { id: number; name: string }

export default async function AgreementsPage() {
  const user = await getSession();
  const canManage = hasPermission(user, 'agreements.manage');

  const [data, employees, cycles] = await Promise.all([
    apiData<{ items: (Agreement & { _count: { entries: number } })[] }>('/agreements'),
    canManage ? apiData<{ items: Employee[] }>('/employees?perPage=100') : Promise.resolve(null),
    canManage ? apiData<{ items: Cycle[] }>('/evaluation-cycles') : Promise.resolve(null),
  ]);
  const items = data?.items ?? [];

  // Load the detailed log for each agreement so progress and entries are visible.
  const detailed = await Promise.all(
    items.map((a) => apiData<{ agreement: Agreement }>(`/agreements/${a.id}`).then((r) => r?.agreement ?? { ...a, entries: [] })),
  );

  return (
    <>
      <PageHeader title="توافق‌نامه‌های عملکرد" description="شاخص‌ها، انتظارات، نتایج کلیدی و پایش پیشرفت" />

      <div className="grid gap-6 xl:grid-cols-3">
        {canManage ? (
          <Card className="xl:col-span-1">
            <CardHeader title="توافق‌نامه جدید" />
            <CardBody>
              <AgreementForm
                employees={(employees?.items ?? []).map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeNo})` }))}
                cycles={cycles?.items ?? []}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card className={canManage ? 'xl:col-span-2' : 'xl:col-span-3'}>
          <CardHeader title="توافق‌نامه‌ها" subtitle={`${items.length} مورد`} />
          {detailed.length === 0 ? (
            <EmptyState title="توافق‌نامه‌ای ثبت نشده است" />
          ) : (
            detailed.map((a) => <AgreementCard key={a.id} agreement={a} canManage={canManage} />)
          )}
        </Card>
      </div>
    </>
  );
}
