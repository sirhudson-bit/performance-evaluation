'use client';

import { useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Alert } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { password as passwordSchema } from '@pe/validation';

export function ProfileForm({ initialName, initialPhone, email }: { initialName: string; initialPhone: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      await apiClient('PATCH', '/auth/profile', { name: name || undefined, phone: phone || undefined });
      setMessage({ type: 'success', text: 'اطلاعات با موفقیت ذخیره شد.' });
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ذخیره.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="ایمیل" htmlFor="p-email" hint="ایمیل توسط مدیر سامانه تعیین می‌شود و از اینجا قابل تغییر نیست.">
        <Input id="p-email" dir="ltr" value={email} disabled />
      </Field>
      <Field label="نام نمایشی" htmlFor="p-name" required>
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="شماره تلفن همراه" htmlFor="p-phone" hint="اختیاری — فقط در صورت نیاز سازمانی ثبت کنید.">
        <Input id="p-phone" dir="ltr" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Button type="submit" disabled={loading}>{loading ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</Button>
    </form>
  );
}

export function PasswordForm() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const check = newPassword.length > 0 ? passwordSchema.safeParse(newPassword) : null;
  const passwordError = check && !check.success ? check.error.issues[0]?.message : undefined;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!currentPassword || !check?.success) {
      setMessage({ type: 'danger', text: passwordError ?? 'رمز عبور فعلی و جدید را کامل وارد کنید.' });
      return;
    }
    setLoading(true);
    try {
      await apiClient('POST', '/auth/password', { currentPassword, newPassword });
      setMessage({ type: 'success', text: 'رمز عبور تغییر کرد و سایر نشست‌ها بسته شدند.' });
      setCurrent('');
      setNew('');
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در تغییر رمز.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="رمز عبور فعلی" htmlFor="cur-pass" required>
        <PasswordInput id="cur-pass" dir="ltr" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="رمز عبور جدید" htmlFor="new-pass" hint="حداقل ۸ نویسه، شامل حرف و رقم." error={passwordError} required>
        <PasswordInput id="new-pass" dir="ltr" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" />
      </Field>
      <Button type="submit" variant="secondary" disabled={loading || Boolean(passwordError) || !check?.success}>{loading ? 'در حال تغییر…' : 'تغییر رمز عبور'}</Button>
    </form>
  );
}
