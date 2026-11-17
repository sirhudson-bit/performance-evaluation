import Link from 'next/link';
import { apiData, getSession, hasPermission } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Table, Td, EmptyState, StatusBadge, Badge, Button, Input, Select } from '@/components/ui';
import { UserRowActions } from '@/components/AdminForms';
import { AddUserDialog } from '@/components/AddUserDialog';
import { UserImportCard } from '@/components/UserImportCard';
import { Pagination } from '@/components/Pagination';
import { faDigits } from '@/lib/format';
import { Search, X } from 'lucide-react';

interface UserItem {
  id: number; name: string; email: string; phone: string | null; status: string;
  department: { id: number; name: string } | null;
  employee: { id: number; employeeNo: string; firstName: string; lastName: string } | null;
  roles: { role: { id: number; key: string; name: string } }[];
}
interface RoleItem { id: number; name: string; key: string; isProtected: boolean }
interface Unit { id: number; name: string }

function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join('') || '؟';
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string; perPage?: string; q?: string; status?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = Math.min(100, Math.max(5, Number(sp.perPage ?? 25)));
  const q = (sp.q ?? '').trim().slice(0, 120);
  const status = ['active', 'suspended', 'archived'].includes(sp.status ?? '') ? sp.status! : '';
  const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (q) query.set('q', q);
  if (status) query.set('status', status);

  const me = await getSession();
  const isSuperAdmin = hasPermission(me, 'settings.manage');
  const canReport = hasPermission(me, 'reports.view');
  const [users, roles, units] = await Promise.all([
    apiData<{ items: UserItem[]; total: number }>(`/users?${query.toString()}`),
    apiData<{ items: RoleItem[] }>('/roles'),
    apiData<{ items: Unit[] }>('/organization/units'),
  ]);
  const roleList = roles?.items ?? [];
  const departmentList = (units?.items ?? []).map((u) => ({ id: u.id, name: u.name }));

  return (
    <>
      <PageHeader
        title="کاربران"
        description="مدیریت حساب‌ها، دپارتمان، نقش‌ها و وضعیت"
        actions={
          hasPermission(me, 'users.create') ? (
            <AddUserDialog roles={roleList} departments={departmentList} isSuperAdmin={isSuperAdmin} />
          ) : null
        }
      />

      <Card>
        <CardHeader
          title="فهرست کاربران"
          subtitle={`${faDigits(users?.total ?? 0)} کاربر${q || status ? ' مطابق جستجو' : ' در سازمان'}`}
          actions={
            <form method="get" className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input name="q" defaultValue={q} placeholder="نام، ایمیل یا کد پرسنلی…" aria-label="جستجوی کاربر" className="h-9 w-52 pr-9 text-xs" />
              </div>
              <Select name="status" defaultValue={status} aria-label="فیلتر وضعیت" className="h-9 w-32 text-xs">
                <option value="">همه وضعیت‌ها</option>
                <option value="active">فعال</option>
                <option value="suspended">معلق</option>
                <option value="archived">بایگانی</option>
              </Select>
              <Button type="submit" size="sm">جستجو</Button>
              {q || status ? (
                <Link href="/admin/users" className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                  <X aria-hidden className="h-3.5 w-3.5" /> پاک کردن
                </Link>
              ) : null}
            </form>
          }
        />
        {!users || users.items.length === 0 ? (
          <EmptyState title={q || status ? 'کاربری با این جستجو پیدا نشد' : 'کاربری یافت نشد'} description={q || status ? 'عبارت جستجو یا فیلتر وضعیت را تغییر دهید.' : 'با دکمه «افزودن کاربر» اولین حساب را بسازید.'} />
        ) : (
          <>
          <div className="hidden md:block">
          <Table head={['کاربر', 'دپارتمان', 'نقش‌ها', 'وضعیت', 'عملیات']}>
            {users.items.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <Td>
                  <div className="flex min-w-[13rem] items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{u.name}</p>
                      <p dir="ltr" className="truncate text-right text-[11px] text-slate-500 dark:text-slate-400">{u.email}</p>
                      {u.employee ? <p className="mt-0.5 text-[10px] text-slate-400">کد پرسنلی {faDigits(u.employee.employeeNo)}</p> : null}
                    </div>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-xs">{u.department?.name ?? '—'}</Td>
                <Td>
                  <div className="flex max-w-[15rem] flex-wrap gap-1">
                    {u.roles.length > 0
                      ? u.roles.map((r) => <Badge key={r.role.id} tone="info" dot={false}>{r.role.name}</Badge>)
                      : <span className="text-xs text-slate-400">بدون نقش</span>}
                  </div>
                </Td>
                <Td className="whitespace-nowrap"><StatusBadge group="userStatus" value={u.status} /></Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    <UserRowActions user={u} roles={roleList} departments={departmentList} isSelf={u.id === me?.id} isSuperAdmin={isSuperAdmin} />
                    {canReport && u.employee ? (
                      <Link href={`/reports/employees/${u.employee.id}`} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                        گزارش عملکرد
                      </Link>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {users.items.map((u) => (
              <div key={u.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{u.name}</p>
                      <p dir="ltr" className="truncate text-right text-[11px] text-slate-500 dark:text-slate-400">{u.email}</p>
                    </div>
                  </div>
                  <StatusBadge group="userStatus" value={u.status} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{u.department?.name ?? 'بدون دپارتمان'}</span>
                  {u.employee ? <span>· کد {faDigits(u.employee.employeeNo)}</span> : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.roles.length > 0
                    ? u.roles.map((r) => <Badge key={r.role.id} tone="info" dot={false}>{r.role.name}</Badge>)
                    : <span className="text-xs text-slate-400">بدون نقش</span>}
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <UserRowActions user={u} roles={roleList} departments={departmentList} isSelf={u.id === me?.id} isSuperAdmin={isSuperAdmin} />
                  {canReport && u.employee ? (
                    <Link href={`/reports/employees/${u.employee.id}`} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                      گزارش عملکرد
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
        <Pagination page={page} perPage={perPage} total={users?.total ?? 0} basePath="/admin/users" params={{ q, status }} />
      </Card>

      {hasPermission(me, 'users.create') ? (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="افزودن گروهی کاربران از اکسل"
              subtitle="قالب بر اساس دپارتمان‌ها و نقش‌های همین سازمان ساخته می‌شود؛ پیش‌نمایش پیش از ثبت"
            />
            <CardBody>
              <UserImportCard />
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}
