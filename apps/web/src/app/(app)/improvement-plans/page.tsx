import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge } from '@/components/ui';
import { ImprovementPlanForm } from '@/components/ImprovementPlanForms';
import { ActionButton } from '@/components/AdminForms';
import { formatJalali } from '@/lib/format';

interface Item { id: number; title: string; status: string; dueDate: string | null; employee: { firstName: string; lastName: string } }
interface Employee { id: number; firstName: string; lastName: string; employeeNo: string }
interface Cycle { id: number; name: string }

export default async function ImprovementPlansPage() {
  const user = await getSession();
  const canManage = hasPermission(user, 'improvement_plans.manage');
  const [data, employees, cycles] = await Promise.all([
    apiData<{ items: Item[] }>('/improvement-plans'),
    canManage ? apiData<{ items: Employee[] }>('/employees?perPage=100') : Promise.resolve(null),
    canManage ? apiData<{ items: Cycle[] }>('/evaluation-cycles') : Promise.resolve(null),
  ]);
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="برنامه‌های بهبود" description="اقدامات بهبود عملکرد کارکنان" />
      <div className="grid gap-6 lg:grid-cols-3">
        {canManage ? (
          <Card className="lg:col-span-1">
            <CardHeader title="برنامه جدید" />
            <CardBody>
              <ImprovementPlanForm
                employees={(employees?.items ?? []).map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeNo})` }))}
                cycles={cycles?.items ?? []}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader title="برنامه‌ها" subtitle={`${items.length} مورد`} />
          {items.length === 0 ? (
            <EmptyState title="برنامه‌ای ثبت نشده است" />
          ) : (
            <Table head={['کارمند', 'عنوان', 'وضعیت', 'مهلت', canManage ? '' : '']}>
              {items.map((p) => (
                <tr key={p.id}>
                  <Td>{p.employee.firstName} {p.employee.lastName}</Td>
                  <Td>{p.title}</Td>
                  <Td><StatusBadge group="improvementPlanStatus" value={p.status} /></Td>
                  <Td>{formatJalali(p.dueDate)}</Td>
                  {canManage ? (
                    <Td><ActionButton method="DELETE" path={`/improvement-plans/${p.id}`} label="حذف" variant="danger" confirm="این برنامه حذف شود؟" /></Td>
                  ) : null}
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
