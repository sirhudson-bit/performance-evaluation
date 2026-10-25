import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, EmptyState, Table, Td, Alert } from '@/components/ui';
import { Pagination } from '@/components/Pagination';
import { ActionButton } from '@/components/AdminForms';
import { formatJalali, faDigits } from '@/lib/format';

interface AuditItem { id: number; action: string; entityType: string; entityId: string | null; actorUserId: number | null; createdAt: string }

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string; perPage?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = Math.min(100, Math.max(5, Number(sp.perPage ?? 25)));

  const user = await getSession();
  const canClear = hasPermission(user, 'settings.manage');
  const data = await apiData<{ items: AuditItem[]; total: number }>(`/admin/audit?page=${page}&perPage=${perPage}`);

  return (
    <>
      <PageHeader title="گزارش رخدادها" description="سوابق append-only رویدادهای حساس (رمزها و توکن‌ها هرگز ثبت نمی‌شوند)" />

      <Alert variant="info">
        برای جلوگیری از رشد بی‌رویهٔ پایگاه داده، می‌توانید رخدادهای قدیمی‌تر از ۳۰ روز را پاک کنید. خودِ عمل پاک‌سازی نیز ثبت می‌شود.
      </Alert>

      <Card className="mt-4">
        <CardHeader
          title="رخدادها"
          subtitle={`${faDigits(data?.total ?? 0)} رخداد`}
          actions={canClear ? <ActionButton method="DELETE" path="/admin/audit/clear?days=30" label="پاک‌سازی قدیمی‌تر از ۳۰ روز" variant="danger" confirm="رخدادهای قدیمی‌تر از ۳۰ روز حذف شوند؟" /> : undefined}
        />
        {!data || data.items.length === 0 ? (
          <EmptyState title="رخدادی ثبت نشده است" />
        ) : (
          <Table head={['زمان', 'اقدام', 'موجودیت', 'شناسه', 'کاربر']}>
            {data.items.map((a) => (
              <tr key={a.id}>
                <Td className="text-xs">{formatJalali(a.createdAt, { withTime: true })}</Td>
                <Td dir="ltr" className="text-xs text-brand-700 dark:text-brand-300">{a.action}</Td>
                <Td dir="ltr" className="text-xs">{a.entityType}</Td>
                <Td className="tabular">{a.entityId ?? '—'}</Td>
                <Td className="tabular">{a.actorUserId ?? '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={page} perPage={perPage} total={data?.total ?? 0} basePath="/admin/audit" />
      </Card>
    </>
  );
}
