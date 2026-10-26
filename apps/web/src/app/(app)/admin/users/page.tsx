import Link from 'next/link';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge, Badge } from '@/components/ui';
import { UserForm, UserRowActions } from '@/components/AdminForms';
import { Pagination } from '@/components/Pagination';
import { faDigits } from '@/lib/format';

interface UserItem {
  id: number; name: string; email: string; phone: string | null; status: string;
  department: { id: number; name: string } | null;
  employee: { id: number; employeeNo: string; firstName: string; lastName: string } | null;
  roles: { role: { id: number; key: string; name: string } }[];
}
interface RoleItem { id: number; name: string; key: string; isProtected: boolean }
interface Unit { id: number; name: string }

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string; perPage?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = Math.min(100, Math.max(5, Number(sp.perPage ?? 25)));

  const me = await getSession();
  const isSuperAdmin = hasPermission(me, 'settings.manage');
  const canReport = hasPermission(me, 'reports.view');
  const [users, roles, units] = await Promise.all([
    apiData<{ items: UserItem[]; total: number }>(`/users?page=${page}&perPage=${perPage}`),
    apiData<{ items: RoleItem[] }>('/roles'),
    apiData<{ items: Unit[] }>('/organization/units'),
  ]);
  const roleList = roles?.items ?? [];
  const departmentList = (units?.items ?? []).map((u) => ({ id: u.id, name: u.name }));

  return (
    <>
      <PageHeader title="کاربران" description="مدیریت حساب‌ها، دپارتمان، نقش‌ها و وضعیت" />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="افزودن کاربر" />
          <CardBody>
            <UserForm roles={roleList} departments={departmentList} isSuperAdmin={isSuperAdmin} />
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="فهرست کاربران" subtitle={`${faDigits(users?.total ?? 0)} کاربر`} />
          {!users || users.items.length === 0 ? (
            <EmptyState title="کاربری یافت نشد" />
          ) : (
            <Table head={['نام', 'ایمیل', 'دپارتمان', 'نقش‌ها', 'وضعیت', '']}>
              {users.items.map((u) => (
                <tr key={u.id}>
                  <Td>{u.name}</Td>
                  <Td dir="ltr" className="text-xs">{u.email}</Td>
                  <Td>{u.department?.name ?? '—'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <Badge key={r.role.id} tone="info">{r.role.name}</Badge>)}
                    </div>
                  </Td>
                  <Td><StatusBadge group="userStatus" value={u.status} /></Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <UserRowActions user={u} roles={roleList} departments={departmentList} isSelf={u.id === me?.id} isSuperAdmin={isSuperAdmin} />
                      {canReport && u.employee ? (
                        <Link href={`/reports/employees/${u.employee.id}`} className="text-xs text-brand-700 hover:underline dark:text-brand-300">
                          گزارش عملکرد
                        </Link>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          <Pagination page={page} perPage={perPage} total={users?.total ?? 0} basePath="/admin/users" />
        </Card>
      </div>
    </>
  );
}
