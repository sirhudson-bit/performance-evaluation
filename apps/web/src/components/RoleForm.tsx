'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Field, Input, Alert } from '@/components/ui';

interface Catalog {
  categories: string[];
  permissions: { name: string; category: string; descriptionFa: string }[];
}
interface Initial {
  id: number;
  name: string;
  key: string;
  description: string | null;
  permissions: string[];
  isProtected: boolean;
}

export function RoleForm({ catalog, initial, onDone }: { catalog: Catalog; initial?: Initial; onDone?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [selected, setSelected] = useState<string[]>(initial?.permissions ?? []);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function togglePerm(p: string) {
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          if (initial) {
            await apiClient('PATCH', `/roles/${initial.id}`, { name, description, permissions: selected });
          } else {
            await apiClient('POST', '/roles', { name, key, description, permissions: selected });
          }
          setMessage({ type: 'success', text: 'نقش ذخیره شد.' });
          router.refresh();
          onDone?.();
        } catch (err) {
          setMessage({ type: 'danger', text: err instanceof ApiClientError ? err.message : 'خطا در ذخیره.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {message ? <Alert variant={message.type}>{message.text}</Alert> : null}
      <Field label="نام نقش" htmlFor="r-name" required><Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      {!initial ? (
        <Field label="شناسه نقش" htmlFor="r-key" hint="حروف کوچک انگلیسی، رقم و زیرخط." required>
          <Input id="r-key" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} required />
        </Field>
      ) : null}
      <Field label="توضیح" htmlFor="r-desc"><Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">دسترسی‌ها ({selected.length})</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {catalog.categories.map((cat) => (
            <div key={cat} className="rounded border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-1 text-xs font-semibold text-slate-500">{cat}</p>
              <div className="space-y-1">
                {catalog.permissions.filter((p) => p.category === cat).map((p) => (
                  <label key={p.name} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={selected.includes(p.name)} onChange={() => togglePerm(p.name)} className="mt-0.5" />
                    <span><code dir="ltr" className="text-brand-700 dark:text-brand-300">{p.name}</code> — {p.descriptionFa}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? '…' : initial ? 'ذخیره تغییرات' : 'ایجاد نقش'}</Button>
        {onDone ? <Button type="button" variant="ghost" onClick={onDone}>انصراف</Button> : null}
      </div>
    </form>
  );
}

export function RoleInlineEditor({ catalog, role }: { catalog: Catalog; role: Initial }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} disabled={role.isProtected}>
        ویرایش
      </Button>
    );
  }
  return (
    <div className="mt-3 rounded border border-slate-200 p-4 dark:border-slate-700">
      <RoleForm catalog={catalog} initial={role} onDone={() => setOpen(false)} />
    </div>
  );
}
