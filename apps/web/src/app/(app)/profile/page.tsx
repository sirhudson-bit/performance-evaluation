import { apiData, getSession } from '@/lib/api';
import { Card, CardHeader, CardBody, PageHeader, Alert, Badge } from '@/components/ui';
import { ProfileForm, PasswordForm } from '@/components/ProfileForms';

interface Me {
  user: { id: number; name: string; email: string; phone: string | null; mfaEnabled: boolean };
  roles: { key: string; name: string }[];
  permissions: string[];
  employee: { id: number; employeeNo: string; firstName: string; lastName: string } | null;
}

export default async function ProfilePage() {
  const me = await apiData<Me>('/auth/me');
  const user = await getSession();

  return (
    <>
      <PageHeader title="پروفایل من" description="اطلاعات شخصی و امنیت حساب" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="اطلاعات شخصی" subtitle="فقط فیلدهای مجاز برای ویرایش نمایش داده می‌شوند" />
          <CardBody className="space-y-4">
            <div>
              <p className="text-xs text-slate-500">شماره پرسنلی</p>
              <p className="text-sm font-medium">{me?.employee?.employeeNo ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">نقش‌ها</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {user?.roles.map((r) => (
                  <Badge key={r.key} tone="info">{r.name}</Badge>
                ))}
              </div>
            </div>
            <ProfileForm initialName={me?.user.name ?? ''} initialPhone={me?.user.phone ?? ''} email={me?.user.email ?? ''} />
            <div className="flex flex-wrap gap-2">
              {me?.roles.map((r) => (
                <span key={r.key} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{r.key}</span>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="امنیت حساب" subtitle="تغییر رمز عبور و احراز هویت دومرحله‌ای" />
          <CardBody className="space-y-6">
            <PasswordForm />
            <Alert variant="info">
              احراز هویت دومرحله‌ای: {me?.user.mfaEnabled ? 'فعال است' : 'غیرفعال است'}.
            </Alert>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
