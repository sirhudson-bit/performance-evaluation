'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiClientError } from '@/lib/client';
import { Alert, Button, Field, Input } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { password as passwordSchema } from '@pe/validation';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiClient<{ message: string }>('POST', '/auth/password/request', { email });
      setMessage({ type: 'success', text: res.message });
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'ارسال پیوند بازیابی ممکن نشد.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="ایمیل" htmlFor="forgot-email" required hint="پیوند بازیابی به ایمیل ثبت‌شده در حساب ارسال می‌شود.">
        <Input id="forgot-email" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </Field>
      <Button type="submit" disabled={busy || !email} className="w-full">
        {busy ? 'در حال ارسال…' : 'ارسال پیوند بازیابی'}
      </Button>
      <p className="text-center text-xs text-slate-500">
        <Link href="/login" className="text-brand-700 hover:underline">
          بازگشت به ورود
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  const check = password.length > 0 ? passwordSchema.safeParse(password) : null;
  const passwordError = check && !check.success ? check.error.issues[0]?.message : undefined;
  const mismatch = password.length > 0 && password !== confirm;
  const canSubmit = Boolean(token) && Boolean(check?.success) && !mismatch;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiClient('POST', '/auth/password/reset', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'تغییر رمز ممکن نشد.' });
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Alert variant="danger">
        پیوند بازیابی معتبر نیست. دوباره از صفحه ورود درخواست کنید.
      </Alert>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert variant="success">رمز عبور تغییر کرد. اکنون با رمز جدید وارد شوید.</Alert>
        <Link href="/login" className="block rounded bg-brand-700 px-4 py-2 text-center text-sm text-white hover:bg-brand-800">
          ورود به سامانه
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="رمز عبور جدید" htmlFor="reset-password" hint="حداقل ۸ نویسه، شامل حرف و رقم." error={passwordError} required>
        <PasswordInput id="reset-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
      </Field>
      <Field label="تکرار رمز جدید" htmlFor="reset-confirm" error={mismatch ? 'رمزها یکسان نیستند.' : undefined} required>
        <PasswordInput id="reset-confirm" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={busy || !canSubmit} className="w-full">
        {busy ? 'در حال ذخیره…' : 'تعیین رمز جدید'}
      </Button>
    </form>
  );
}
