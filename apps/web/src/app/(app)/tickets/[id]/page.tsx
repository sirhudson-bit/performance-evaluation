import { notFound } from 'next/navigation';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardBody, StatusBadge } from '@/components/ui';
import { TicketThread } from '@/components/TicketForms';

interface Ticket { id: number; subject: string; status: string; category: string; priority: string; user: { id: number; name: string }; messages: { id: number; fromStaff: boolean; body: string; createdAt: string; author: { id: number; name: string } | null }[] }

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  const data = await apiData<{ ticket: Ticket }>(`/tickets/${id}`);
  if (!data) notFound();

  return (
    <>
      <PageHeader title={data.ticket.subject} description={`درخواستکننده: ${data.ticket.user.name}`} actions={<StatusBadge group="ticketStatus" value={data.ticket.status} />} />
      <Card>
        <CardBody>
          <TicketThread ticket={data.ticket} isStaff={hasPermission(user, 'tickets.manage')} />
        </CardBody>
      </Card>
    </>
  );
}
