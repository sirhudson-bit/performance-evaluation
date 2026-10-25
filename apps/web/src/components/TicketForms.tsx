'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Textarea, Select, Alert, Badge } from '@/components/ui';
import { formatJalali } from '@/lib/format';

export function TicketCreateForm() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          await apiClient('POST', '/tickets', { subject, category, priority, body });
          setMessage({ type: 'success', text: 'درخواست ثبت شد.' });
          setSubject('');
          setBody('');
          router.refresh();
        } catch (err) {
          setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ثبت.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="موضوع" htmlFor="t-subject" required><Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="دسته" htmlFor="t-cat"><Select id="t-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="general">عمومی</option><option value="evaluation">ارزیابی</option><option value="technical">فنی</option><option value="other">سایر</option>
        </Select></Field>
        <Field label="اولویت" htmlFor="t-pri"><Select id="t-pri" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">کم</option><option value="normal">عادی</option><option value="high">بالا</option>
        </Select></Field>
      </div>
      <Field label="متن پیام" htmlFor="t-body" required><Textarea id="t-body" value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ثبت درخواست'}</Button>
    </form>
  );
}

interface Msg { id: number; fromStaff: boolean; body: string; createdAt: string; author: { id: number; name: string } | null }
interface Ticket { id: number; subject: string; status: string; category: string; priority: string; messages: Msg[]; user: { id: number; name: string } }

const STATUS = [
  { value: 'open', label: 'باز' },
  { value: 'in_progress', label: 'در حال بررسی' },
  { value: 'answered', label: 'پاسخ داده شده' },
  { value: 'closed', label: 'بسته' },
];

export function TicketThread({ ticket, isStaff }: { ticket: Ticket; isStaff: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [status, setStatus] = useState(ticket.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient('POST', `/tickets/${ticket.id}/messages`, { body });
      setBody('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در ارسال.');
    } finally {
      setBusy(false);
    }
  }

  async function saveStatus() {
    setBusy(true);
    setError(null);
    try {
      await apiClient('PATCH', `/tickets/${ticket.id}`, { status });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در تغییر وضعیت.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`rounded border p-3 text-sm ${m.fromStaff ? 'border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>{m.author?.name ?? '—'} {m.fromStaff ? <Badge tone="info">پشتیبانی</Badge> : null}</span>
              <span>{formatJalali(m.createdAt, { withTime: true })}</span>
            </div>
            <p className="whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-200">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== 'closed' ? (
        <form onSubmit={reply} className="space-y-2">
          <label htmlFor="reply" className="text-sm font-medium text-slate-700 dark:text-slate-300">پاسخ</label>
          <Textarea id="reply" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button type="submit" disabled={busy}>{busy ? '…' : 'ارسال پاسخ'}</Button>
        </form>
      ) : (
        <Alert variant="muted">این تیکت بسته شده است.</Alert>
      )}

      {isStaff ? (
        <div className="flex items-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Field label="تغییر وضعیت" htmlFor="t-status">
            <Select id="t-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Button variant="secondary" onClick={saveStatus} disabled={busy}>ذخیره وضعیت</Button>
        </div>
      ) : null}
    </div>
  );
}
