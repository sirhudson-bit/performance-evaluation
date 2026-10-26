import { ForgotPasswordForm } from '@/components/PasswordResetForms';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded border border-slate-200 bg-surface p-8 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">بازیابی رمز عبور</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">
          ایمیل حساب خود را وارد کنید تا پیوند یک‌بارمصرف برای تعیین رمز جدید ارسال شود.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
