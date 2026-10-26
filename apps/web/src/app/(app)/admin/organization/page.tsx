import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, Alert } from '@/components/ui';
import { UnitForm, PositionForm, UnitRowActions, PositionRowActions } from '@/components/OrgForms';
import { ActionButton } from '@/components/AdminForms';

interface Unit { id: number; name: string; code: string | null; type: string; parentId: number | null; status: string; _count: { employees: number } }
interface Position { id: number; title: string; code: string | null; unitId: number | null; status: string }

export default async function AdminOrganizationPage() {
  const [units, positions] = await Promise.all([
    apiData<{ items: Unit[] }>('/organization/units'),
    apiData<{ items: Position[] }>('/organization/positions'),
  ]);
  const unitList = units?.items ?? [];
  const unitOptions = unitList.map((u) => ({ id: u.id, name: u.name }));

  return (
    <>
      <PageHeader title="ساختار سازمانی" description="واحدها، سمت‌ها و روابط سازمانی" />
      <Alert variant="info">مثال‌ها: حسابداری، انبار، بازاریابی. تغییرات سازمانی در گزارش رخدادها ثبت می‌شود.</Alert>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="افزودن واحد" />
          <CardBody><UnitForm units={unitOptions} /></CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="واحدها" subtitle={`${unitList.length} واحد`} />
          {unitList.length === 0 ? (
            <EmptyState title="واحدی ثبت نشده است" />
          ) : (
            <Table head={['نام', 'کد', 'نوع', 'کارکنان', '']}>
              {unitList.map((u) => (
                <tr key={u.id}>
                  <Td>{u.name}</Td>
                  <Td dir="ltr">{u.code ?? '—'}</Td>
                  <Td>{u.type}</Td>
                  <Td className="tabular">{u._count.employees}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <UnitRowActions unit={u} units={unitOptions} />
                      <ActionButton method="DELETE" path={`/organization/units/${u.id}`} label="حذف" variant="danger" confirm="این واحد حذف/بایگانی شود؟" />
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="افزودن سمت" />
          <CardBody><PositionForm units={unitOptions} /></CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="سمت‌ها" subtitle={`${positions?.items.length ?? 0} سمت`} />
          {!positions || positions.items.length === 0 ? (
            <EmptyState title="سمتی ثبت نشده است" />
          ) : (
            <Table head={['عنوان', 'کد', '']}>
              {positions.items.map((p) => (
                <tr key={p.id}>
                  <Td>{p.title}</Td>
                  <Td dir="ltr">{p.code ?? '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <PositionRowActions position={p} units={unitOptions} />
                      <ActionButton method="DELETE" path={`/organization/positions/${p.id}`} label="حذف" variant="danger" confirm="این سمت حذف/بایگانی شود؟" />
                    </div>
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
