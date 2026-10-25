import { apiData } from '@/lib/api';
import { PageHeader, Card, Table, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatJalali } from '@/lib/format';

interface Item {
  id: number;
  status: string;
  reason: string;
  createdAt: string;
  employee: { firstName: string; lastName: string };
  cycle: { name: string };
}

export default async function AppealsPage() {
  const data = await apiData<{ items: Item[] }>('/evaluations/appeals/list');
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="اعتراض‌ها" description="درخواست‌های اعتراض ثبت‌شده در محدوده دسترسی شما" />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="اعتراضی ثبت نشده است" description="اعتراض‌ها فقط برای دوره‌هایی که امکان اعتراض در آن‌ها فعال است، ثبت می‌شوند." />
        ) : (
          <Table head={['کارمند', 'دوره', 'وضعیت', 'تاریخ ثبت', 'دلیل']}>
            {items.map((a) => (
              <tr key={a.id}>
                <Td>{a.employee.firstName} {a.employee.lastName}</Td>
                <Td>{a.cycle.name}</Td>
                <Td><StatusBadge group="appealStatus" value={a.status} /></Td>
                <Td>{formatJalali(a.createdAt)}</Td>
                <Td className="max-w-md truncate">{a.reason}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
