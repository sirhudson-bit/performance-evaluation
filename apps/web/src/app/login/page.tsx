import { redirect } from 'next/navigation';
import { getSession } from '@/lib/api';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded border border-slate-200 bg-surface p-8 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">ورود به سامانه</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">برای ادامه، اطلاعات حساب خود را وارد کنید.</p>
        <LoginForm />
      </div>
    </main>
  );
}
