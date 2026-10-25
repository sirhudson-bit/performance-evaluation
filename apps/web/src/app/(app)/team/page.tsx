import { apiData } from '@/lib/api';
import { PageHeader, Card, Table, Td, EmptyState, StatusBadge } from '@/components/ui';

interface Item {
  id: number;
  employeeNo: string;
  firstName: string;
  lastName: string;
  status: string;
  unit: { name: string } | null;
  position: { title: string } | null;
  manager: { firstName: string; lastName: string } | null;
}

export default async function TeamPage() {
  const data = await apiData<{ items: Item[]; total: number }>('/employees?perPage=50');
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="کارکنان" description="کارکنان در محدوده دسترسی سازمانی شما" />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="کارمندی یافت نشد" />
        ) : (
          <Table head={['شماره پرسنلی', 'نام', 'واحد', 'سمت', 'مدیر مستقیم', 'وضعیت']}>
            {items.map((e) => (
              <tr key={e.id}>
                <Td className="tabular">{e.employeeNo}</Td>
                <Td>{e.firstName} {e.lastName}</Td>
                <Td>{e.unit?.name ?? '—'}</Td>
                <Td>{e.position?.title ?? '—'}</Td>
                <Td>{e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '—'}</Td>
                <Td><StatusBadge group="employeeStatus" value={e.status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
