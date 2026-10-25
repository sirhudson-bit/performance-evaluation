'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Select, Alert } from '@/components/ui';

interface Unit { id: number; name: string; code: string | null; type: string; parentId: number | null; status: string }
interface Position { id: number; title: string; code: string | null; unitId: number | null; status: string }

export function UnitForm({ units, initial, onDone }: { units: { id: number; name: string }[]; initial?: Unit; onDone?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [type, setType] = useState(initial?.type ?? 'department');
  const [parentId, setParentId] = useState(initial?.parentId ? String(initial.parentId) : '');
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
          const payload = { name, code: code || undefined, type, parentId: parentId ? Number(parentId) : null };
          if (initial) await apiClient('PATCH', `/organization/units/${initial.id}`, payload);
          else await apiClient('POST', '/organization/units', payload);
          setMessage({ type: 'success', text: 'ذخیره شد.' });
          router.refresh();
          onDone?.();
        } catch (err) {
          setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="نام واحد" htmlFor="u-name" required><Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="کد" htmlFor="u-code"><Input id="u-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="نوع" htmlFor="u-type"><Select id="u-type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="department">دپارتمان</option><option value="subdepartment">زیرواحد</option><option value="team">تیم</option><option value="division">معاونت</option>
        </Select></Field>
      </div>
      <Field label="واحد بالادستی" htmlFor="u-parent">
        <Select id="u-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">بدون والد</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? '…' : initial ? 'ذخیره' : 'افزودن واحد'}</Button>
        {onDone ? <Button type="button" variant="ghost" onClick={onDone}>انصراف</Button> : null}
      </div>
    </form>
  );
}

export function PositionForm({ units, initial, onDone }: { units: { id: number; name: string }[]; initial?: Position; onDone?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [unitId, setUnitId] = useState(initial?.unitId ? String(initial.unitId) : '');
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
          const payload = { title, code: code || undefined, unitId: unitId ? Number(unitId) : null };
          if (initial) await apiClient('PATCH', `/organization/positions/${initial.id}`, payload);
          else await apiClient('POST', '/organization/positions', payload);
          setMessage({ type: 'success', text: 'ذخیره شد.' });
          router.refresh();
          onDone?.();
        } catch (err) {
          setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="عنوان شغلی" htmlFor="p-title" required><Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="کد" htmlFor="p-code"><Input id="p-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="واحد" htmlFor="p-unit"><Select id="p-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">بدون واحد</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select></Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? '…' : initial ? 'ذخیره' : 'افزودن سمت'}</Button>
        {onDone ? <Button type="button" variant="ghost" onClick={onDone}>انصراف</Button> : null}
      </div>
    </form>
  );
}

/** Row actions own their open/close state (a render function cannot be passed
 * from a Server Component to a Client Component). */
export function UnitRowActions({ unit, units }: { unit: Unit; units: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="ghost" onClick={() => setOpen(true)}>ویرایش</Button>;
  return (
    <div className="mt-2 rounded border border-slate-200 p-3 dark:border-slate-700">
      <UnitForm units={units} initial={unit} onDone={() => setOpen(false)} />
    </div>
  );
}

export function PositionRowActions({ position, units }: { position: Position; units: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="ghost" onClick={() => setOpen(true)}>ویرایش</Button>;
  return (
    <div className="mt-2 rounded border border-slate-200 p-3 dark:border-slate-700">
      <PositionForm units={units} initial={position} onDone={() => setOpen(false)} />
    </div>
  );
}
