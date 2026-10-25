import { apiData } from '@/lib/api';
import { PageHeader, Card, StatusBadge, Table, Td, EmptyState, LinkButton } from '@/components/ui';
import { formatJalali } from '@/lib/format';
import { RoleLabel } from '@/components/RoleLabel';

interface Item {
  id: number;
  status: string;
  evaluatorRole: string;
  dueDate: string | null;
  cycle: { id: number; name: string };
  employee: { firstName: string; lastName: string; employeeNo: string };
  answeredCount: number;
}

export default async function EvaluationsPage() {
  const data = await apiData<{ items: Item[] }>('/evaluations');
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="ارزیابی‌های من" description="ارزیابی‌هایی که به شما ارجاع شده است" />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="ارزیابی‌ای به شما ارجاع نشده است" description="پس از ارجاع توسط مدیر، در این بخش نمایش داده می‌شود." />
        ) : (
          <Table head={['کارمند', 'دوره', 'نقش شما', 'وضعیت', 'مهلت', 'پاسخ‌ها', '']}>
            {items.map((a) => (
              <tr key={a.id}>
                <Td>{a.employee.firstName} {a.employee.lastName}</Td>
                <Td>{a.cycle.name}</Td>
                <Td><RoleLabel role={a.evaluatorRole} /></Td>
                <Td><StatusBadge group="assignmentStatus" value={a.status} /></Td>
                <Td>{formatJalali(a.dueDate)}</Td>
                <Td className="tabular">{a.answeredCount}</Td>
                <Td>
                  <LinkButton href={`/evaluations/${a.id}`} variant={['assigned', 'in_progress', 'returned_for_revision'].includes(a.status) ? 'primary' : 'secondary'}>
                    {['assigned', 'in_progress', 'returned_for_revision'].includes(a.status) ? 'تکمیل' : 'مشاهده'}
                  </LinkButton>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
