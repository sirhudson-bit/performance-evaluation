import { ResetPasswordForm } from '@/components/PasswordResetForms';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded border border-slate-200 bg-surface p-8 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">تعیین رمز عبور جدید</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">
          رمز جدید را وارد کنید؛ پیوند بازیابی یک‌بارمصرف است.
        </p>
        <ResetPasswordForm token={token ?? ''} />
      </div>
    </main>
  );
}
