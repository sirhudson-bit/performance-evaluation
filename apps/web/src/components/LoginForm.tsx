'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Alert } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient('POST', '/auth/login', { email, password });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در ورود.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Field label="ایمیل" htmlFor="email" required>
        <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </Field>
      <Field label="رمز عبور" htmlFor="password" required>
        <Input id="password" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'در حال ورود…' : 'ورود'}
      </Button>
      <p className="text-center text-xs text-slate-500">
        رمز عبور خود را فراموش کرده‌اید؟{' '}
        <a href="/forgot-password" className="text-brand-700 hover:underline">
          بازیابی رمز
        </a>
      </p>
    </form>
  );
}
