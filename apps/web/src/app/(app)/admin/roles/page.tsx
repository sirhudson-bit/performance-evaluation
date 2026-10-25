import { apiData } from '@/lib/api';
import { PageHeader, Card, CardHeader, CardBody, Badge, EmptyState, Alert } from '@/components/ui';
import { RoleForm, RoleInlineEditor } from '@/components/RoleForm';
import { ActionButton } from '@/components/AdminForms';

interface RoleItem { id: number; key: string; name: string; description: string | null; isProtected: boolean; userCount: number; permissions: string[] }
interface Catalog { categories: string[]; permissions: { name: string; category: string; descriptionFa: string }[] }

export default async function AdminRolesPage() {
  const [roles, catalog] = await Promise.all([
    apiData<{ items: RoleItem[] }>('/roles'),
    apiData<Catalog>('/roles/permissions'),
  ]);
  const cat: Catalog = catalog ?? { categories: [], permissions: [] };

  return (
    <>
      <PageHeader title="نقش‌ها و دسترسی‌ها" description="ایجاد و ویرایش نقش‌ها و دسترسی‌ها" />
      <Alert variant="info">نقش محافظت‌شده قابل ویرایش یا واگذاری نیست. دسترسی‌ها در سرور و برای هر درخواست بررسی می‌شوند.</Alert>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="نقش جدید" />
          <CardBody><RoleForm catalog={cat} /></CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="نقش‌ها" subtitle={`${roles?.items.length ?? 0} نقش`} />
          {!roles || roles.items.length === 0 ? (
            <EmptyState title="نقشی یافت نشد" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {roles.items.map((r) => (
                <div key={r.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {r.name} <span className="text-xs text-slate-400" dir="ltr">({r.key})</span>
                      </p>
                      <p className="text-xs text-slate-500">کاربران: {r.userCount} • دسترسی‌ها: {r.permissions.length}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.isProtected ? <Badge tone="warning">محافظت‌شده</Badge> : null}
                      <RoleInlineEditor catalog={cat} role={r} />
                      {r.isProtected ? null : (
                        <ActionButton method="DELETE" path={`/roles/${r.id}`} label="حذف" variant="danger" confirm="این نقش حذف شود؟" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
