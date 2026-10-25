'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Select, Textarea, Alert } from '@/components/ui';

export function CompensationProposalForm({ employees, cycles }: { employees: { id: number; label: string }[]; cycles: { id: number; name: string }[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [mode, setMode] = useState('recommendation');
  const [proposedType, setProposedType] = useState('percent');
  const [proposedValue, setProposedValue] = useState('');
  const [rationale, setRationale] = useState('');
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
          await apiClient('POST', '/compensation/recommendations', {
            employeeId: Number(employeeId),
            cycleId: cycleId ? Number(cycleId) : null,
            mode,
            proposedType,
            proposedValue: proposedValue ? Number(proposedValue) : null,
            rationale,
          });
          setMessage({ type: 'success', text: 'پیشنهاد ثبت شد و برای تأیید ارسال می‌شود.' });
          setProposedValue('');
          setRationale('');
          router.refresh();
        } catch (err) {
          setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ثبت.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="کارمند" htmlFor="c-emp" required>
        <Select id="c-emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          <option value="">انتخاب کنید…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </Select>
      </Field>
      <Field label="دوره (اختیاری)" htmlFor="c-cycle">
        <Select id="c-cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
          <option value="">بدون دوره</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="نوع پیشنهاد" htmlFor="c-type"><Select id="c-type" value={proposedType} onChange={(e) => setProposedType(e.target.value)}>
          <option value="percent">درصد</option><option value="amount">مبلغ</option><option value="promotion">ارتقا</option>
        </Select></Field>
        <Field label="مقدار" htmlFor="c-value"><Input id="c-value" dir="ltr" type="number" value={proposedValue} onChange={(e) => setProposedValue(e.target.value)} /></Field>
        <Field label="حالت" htmlFor="c-mode"><Select id="c-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="recommendation">پیشنهاد</option><option value="policy">بر پایه سیاست</option>
        </Select></Field>
      </div>
      <Field label="توضیح" htmlFor="c-rationale"><Textarea id="c-rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} /></Field>
      <Button type="submit" disabled={busy}>{busy ? '…' : 'ثبت پیشنهاد'}</Button>
      <p className="text-xs text-slate-500">این پیشنهاد تا پیش از تصمیم قابل ویرایش است و پس از ثبت، توسط مدیر سامانه یا منابع انسانی بررسی می‌شود.</p>
    </form>
  );
}

export function ProposalActions({ id, type, value, canApprove }: { id: number; type: string | null; value: string | null; canApprove: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState(type ?? 'percent');
  const [editValue, setEditValue] = useState(value ?? '');

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" onClick={() => setEditing((v) => !v)}>{editing ? 'بستن' : 'ویرایش'}</Button>
        {canApprove ? (
          <>
            <Button variant="primary" disabled={busy} onClick={() => run(() => apiClient('POST', `/compensation/recommendations/${id}/decision`, { decision: 'approved', isOverride: false }))}>تأیید</Button>
            <Button variant="danger" disabled={busy} onClick={() => run(() => apiClient('POST', `/compensation/recommendations/${id}/decision`, { decision: 'rejected', isOverride: false }))}>رد</Button>
          </>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <Select aria-label="نوع" value={editType} onChange={(e) => setEditType(e.target.value)}>
            <option value="percent">درصد</option><option value="amount">مبلغ</option><option value="promotion">ارتقا</option>
          </Select>
          <Input aria-label="مقدار" dir="ltr" type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-28" />
          <Button variant="secondary" disabled={busy} onClick={() => run(() => apiClient('PATCH', `/compensation/recommendations/${id}`, { proposedType: editType, proposedValue: editValue ? Number(editValue) : null }))}>ذخیره</Button>
        </div>
      ) : null}
    </div>
  );
}
