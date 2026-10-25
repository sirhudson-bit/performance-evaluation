import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge, Alert } from '@/components/ui';
import { CompensationProposalForm, ProposalActions } from '@/components/CompensationForms';
import { formatScore } from '@/lib/format';

interface Item {
  id: number;
  mode: string;
  proposedType: string | null;
  proposedValue: string | null;
  status: string;
  inputScore: string | null;
  employee: { firstName: string; lastName: string };
  policy: { name: string; version: number } | null;
}
interface Employee { id: number; firstName: string; lastName: string; employeeNo: string }
interface Cycle { id: number; name: string }

const TYPE_LABELS: Record<string, string> = { percent: 'درصد', amount: 'مبلغ', promotion: 'ارتقا' };
const DECIDED = ['approved', 'rejected', 'cancelled'];

export default async function CompensationPage() {
  const user = await getSession();
  const canRecommend = hasPermission(user, 'compensation.recommend');
  const canApprove = hasPermission(user, 'compensation.approve');

  const [data, employees, cycles] = await Promise.all([
    apiData<{ items: Item[] }>('/compensation/recommendations'),
    canRecommend ? apiData<{ items: Employee[] }>('/employees?perPage=100') : Promise.resolve(null),
    apiData<{ items: Cycle[] }>('/evaluation-cycles'),
  ]);
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="جبران خدمات" description="پیشنهاد پاداش و افزایش حقوق بر پایه ارزیابی" />

      <Alert variant="warning">
        این موارد صرفاً «پیشنهاد» هستند. هیچ پرداخت، افزایش حقوق یا تصمیم استخدامی به‌صورت خودکار اجرا نمی‌شود؛ تصمیم نهایی با فرد مجاز است و ثبت می‌گردد.
      </Alert>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {canRecommend ? (
          <Card className="lg:col-span-1">
            <CardHeader title="پیشنهاد جدید" subtitle="مدیر مستقیم می‌تواند برای کارکنان تحت مدیریت خود پیشنهاد ثبت کند" />
            <CardBody>
              <CompensationProposalForm
                employees={(employees?.items ?? []).map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeNo})` }))}
                cycles={cycles?.items ?? []}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card className={canRecommend ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader title="پیشنهادها" subtitle={`${items.length} مورد`} />
          {items.length === 0 ? (
            <EmptyState title="پیشنهادی ثبت نشده است" />
          ) : (
            <Table head={['کارمند', 'سیاست', 'نوع', 'مقدار', 'امتیاز ورودی', 'وضعیت', 'اقدام']}>
              {items.map((c) => (
                <tr key={c.id}>
                  <Td>{c.employee.firstName} {c.employee.lastName}</Td>
                  <Td>{c.policy ? `${c.policy.name} (v${c.policy.version})` : '—'}</Td>
                  <Td>{c.proposedType ? TYPE_LABELS[c.proposedType] ?? c.proposedType : '—'}</Td>
                  <Td className="tabular">{c.proposedValue ?? '—'}</Td>
                  <Td className="tabular">{formatScore(c.inputScore)}</Td>
                  <Td><StatusBadge group="compensationStatus" value={c.status} /></Td>
                  <Td>
                    {DECIDED.includes(c.status) ? (
                      <span className="text-xs text-slate-400">تصمیم‌گیری‌شده</span>
                    ) : (
                      <ProposalActions id={c.id} type={c.proposedType} value={c.proposedValue} canApprove={canApprove} />
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
