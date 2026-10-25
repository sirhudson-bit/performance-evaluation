'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Select, Textarea, Alert } from '@/components/ui';
import { JalaliDateInput } from '@/components/JalaliDateInput';

export function ImprovementPlanForm({ employees, cycles }: { employees: { id: number; label: string }[]; cycles: { id: number; name: string }[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('active');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [actions, setActions] = useState('');
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
          await apiClient('POST', '/improvement-plans', {
            employeeId: Number(employeeId),
            cycleId: cycleId ? Number(cycleId) : null,
            title,
            status,
            dueDate: dueDate ?? undefined,
            actions: actions.split('\n').map((s) => s.trim()).filter(Boolean).map((description) => ({ description, done: false })),
          });
          setMessage({ type: 'success', text: 'برنامه بهبود ثبت شد.' });
          setTitle('');
          setActions('');
          router.refresh();
        } catch (err) {
          setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ثبت.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="کارمند" htmlFor="ip-emp" required>
        <Select id="ip-emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          <option value="">انتخاب کنید…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </Select>
      </Field>
      <Field label="دوره (اختیاری)" htmlFor="ip-cycle">
        <Select id="ip-cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
          <option value="">بدون دوره</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="عنوان برنامه" htmlFor="ip-title" required><Input id="ip-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="اقدام‌ها (هر خط یک اقدام)" htmlFor="ip-actions"><Textarea id="ip-actions" value={actions} onChange={(e) => setActions(e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="وضعیت" htmlFor="ip-status"><Select id="ip-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">در جریان</option><option value="draft">پیش‌نویس</option><option value="completed">تکمیل‌شده</option><option value="cancelled">لغو‌شده</option>
        </Select></Field>
        <Field label="مهلت (شمسی)" htmlFor="ip-due"><JalaliDateInput id="ip-due" value={dueDate} onChange={setDueDate} /></Field>
      </div>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ثبت برنامه'}</Button>
    </form>
  );
}
