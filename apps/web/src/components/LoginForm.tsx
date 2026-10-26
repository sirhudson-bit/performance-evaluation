'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Alert } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { cn } from '@pe/ui';

type Mode = 'password' | 'otp';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (codeSent) codeRef.current?.focus();
  }, [codeSent]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setCode('');
    setCodeSent(false);
    setCooldown(0);
  }

  async function requestCode() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await apiClient<{ message: string; expiresIn: number }>('POST', '/auth/otp/request', { email });
      setCodeSent(true);
      setCooldown(60);
      setInfo(`${res.message} کد تا ${Math.round(res.expiresIn / 60)} دقیقه معتبر است.`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'ارسال کد ورود ممکن نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (mode === 'password') {
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
      return;
    }
    if (!codeSent) {
      await requestCode();
      return;
    }
    setLoading(true);
    try {
      await apiClient('POST', '/auth/otp/verify', { email, code });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'کد وارد‌شده معتبر نیست.');
    } finally {
      setLoading(false);
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      'flex-1 rounded px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-brand-700 text-white shadow-sm'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    );

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="روش ورود"
        className="flex gap-1 rounded border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60"
      >
        <button type="button" role="tab" aria-selected={mode === 'password'} className={tabClass(mode === 'password')} onClick={() => switchMode('password')}>
          رمز عبور
        </button>
        <button type="button" role="tab" aria-selected={mode === 'otp'} className={tabClass(mode === 'otp')} onClick={() => switchMode('otp')}>
          رمز یک‌بار مصرف
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {info ? <Alert variant="info">{info}</Alert> : null}

        <Field label="ایمیل" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            disabled={mode === 'otp' && codeSent}
          />
        </Field>

        {mode === 'password' ? (
          <>
            <Field label="رمز عبور" htmlFor="password" required>
              <PasswordInput
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
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
          </>
        ) : codeSent ? (
          <>
            <Field label="کد شش‌رقمی" htmlFor="otp-code" required hint="کد ارسال‌شده به شماره همراه ثبت‌شده در حساب را وارد کنید.">
              <Input
                ref={codeRef}
                id="otp-code"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\s/g, ''))}
                className="text-center text-lg tracking-[0.5em]"
                required
              />
            </Field>
            <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
              {loading ? 'در حال بررسی…' : 'ورود با کد'}
            </Button>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <button type="button" className="text-brand-700 hover:underline" onClick={() => void requestCode()} disabled={loading || cooldown > 0}>
                {cooldown > 0 ? `ارسال دوباره تا ${cooldown} ثانیه` : 'ارسال دوباره کد'}
              </button>
              <button
                type="button"
                className="hover:underline"
                onClick={() => {
                  setCodeSent(false);
                  setCode('');
                  setInfo(null);
                  setError(null);
                }}
                disabled={loading}
              >
                تغییر ایمیل
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
              کد یک‌بار مصرف به شماره همراهی که در حساب شما ثبت شده ارسال می‌شود. اگر شماره‌ای ثبت نشده باشد، از رمز عبور استفاده کنید.
            </p>
            <Button type="submit" disabled={loading || !email} className="w-full">
              {loading ? 'در حال ارسال…' : 'ارسال کد ورود'}
            </Button>
            <p className="text-center text-xs text-slate-500">
              ورود با رمز عبور را ترجیح می‌دهید؟{' '}
              <button type="button" className="text-brand-700 hover:underline" onClick={() => switchMode('password')}>
                بازگشت
              </button>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
