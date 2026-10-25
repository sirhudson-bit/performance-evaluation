import Link from 'next/link';
import { apiData } from '@/lib/api';
import { PageHeader, Card, Table, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatJalali } from '@/lib/format';

interface Item { id: number; subject: string; status: string; priority: string; lastMessageAt: string; user: { name: string }; assignedTo: { name: string } | null }

export default async function AdminTicketsPage() {
  const data = await apiData<{ items: Item[] }>('/tickets?all=1');
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="مدیریت تیکت‌ها" description="همه درخواست‌های سازمان" />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="تیکتی ثبت نشده است" />
        ) : (
          <Table head={['موضوع', 'درخواست‌کننده', 'مسئول', 'وضعیت', 'آخرین به‌روزرسانی', '']}>
            {items.map((t) => (
              <tr key={t.id}>
                <Td>{t.subject}</Td>
                <Td>{t.user.name}</Td>
                <Td>{t.assignedTo?.name ?? '—'}</Td>
                <Td><StatusBadge group="ticketStatus" value={t.status} /></Td>
                <Td>{formatJalali(t.lastMessageAt, { withTime: true })}</Td>
                <Td><Link href={`/tickets/${t.id}`} className="text-brand-700 hover:underline">پاسخ</Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
