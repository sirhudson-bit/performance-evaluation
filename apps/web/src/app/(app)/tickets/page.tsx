import Link from 'next/link';
import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge } from '@/components/ui';
import { TicketCreateForm } from '@/components/TicketForms';
import { formatJalali } from '@/lib/format';

interface Item { id: number; subject: string; status: string; priority: string; lastMessageAt: string; _count: { messages: number } }

export default async function TicketsPage() {
  const data = await apiData<{ items: Item[] }>('/tickets');
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="پیام‌ها و تیکت‌ها" description="ارتباط با پشتیبانی و پیگیری درخواست‌ها" />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="درخواست جدید" />
          <CardBody><TicketCreateForm /></CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="درخواست‌های من" subtitle={`${items.length} مورد`} />
          {items.length === 0 ? (
            <EmptyState title="درخواستی ثبت نشده است" description="در صورت نیاز به کمک، یک درخواست جدید ثبت کنید." />
          ) : (
            <Table head={['موضوع', 'وضعیت', 'اولویت', 'پیام‌ها', 'آخرین به‌روزرسانی', '']}>
              {items.map((t) => (
                <tr key={t.id}>
                  <Td>{t.subject}</Td>
                  <Td><StatusBadge group="ticketStatus" value={t.status} /></Td>
                  <Td>{t.priority === 'high' ? 'بالا' : t.priority === 'low' ? 'کم' : 'عادی'}</Td>
                  <Td className="tabular">{t._count.messages}</Td>
                  <Td>{formatJalali(t.lastMessageAt, { withTime: true })}</Td>
                  <Td><Link href={`/tickets/${t.id}`} className="text-brand-700 hover:underline">مشاهده</Link></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
