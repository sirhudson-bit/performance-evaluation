'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient, apiUpload, ApiClientError } from '@/lib/client';
import { Alert, Badge, Button, Field, Table, Td, Input } from '@/components/ui';
import { faDigits } from '@/lib/format';

interface ParsedRow {
  rowNumber: number;
  name: string;
  email: string;
  phone?: string;
  departmentId: number | null;
  departmentName: string | null;
  roleIds: number[];
  roleNames: string[];
  status: string;
  password?: string;
}

interface Preview {
  validCount: number;
  invalidCount: number;
  valid: ParsedRow[];
  invalid: { row: number; errors: string[]; raw: string[] }[];
  limits: { maxRows: number };
}

interface ConfirmResult {
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
  credentials: { name: string; email: string; password: string }[];
}

const STATUS_FA: Record<string, string> = { active: 'فعال', suspended: 'غیرفعال', archived: 'بایگانی' };

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((line) => line.map(escape).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The Excel half of the users screen. Everything is staged: the file is parsed
 * and validated server-side into a preview, and nothing is written until the
 * operator presses «ثبت نهایی» — the same confirm step as the single-user form,
 * only for a whole sheet.
 */
export function UserImportCard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!file) {
      setError('ابتدا فایل اکسل را انتخاب کنید.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiUpload<Preview>('/users/import/preview', form);
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiClientError ? err.message : 'خطا در بررسی فایل.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiClient<ConfirmResult>('POST', '/users/import/confirm', {
        rows: preview.valid.map((r) => ({
          rowNumber: r.rowNumber,
          name: r.name,
          email: r.email,
          phone: r.phone,
          departmentId: r.departmentId,
          roleIds: r.roleIds,
          status: r.status,
          ...(r.password ? { password: r.password } : {}),
        })),
      });
      setResult(data);
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در ثبت کاربران.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-3">
        <a
          href="/api/v1/users/import/template"
          className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Download aria-hidden className="h-4 w-4" /> دانلود قالب اکسل
        </a>
        <Field label="فایل تکمیل‌شده" htmlFor="users-import-file" hint="قالب را پر کنید و همان فایل xlsx را اینجا بگذارید.">
          <Input
            id="users-import-file"
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
            }}
            className="cursor-pointer"
          />
        </Field>
        <Button type="button" variant="secondary" disabled={busy || !file} onClick={() => void check()}>
          <Upload aria-hidden className="h-4 w-4" /> {busy && !preview ? 'در حال بررسی…' : 'بررسی فایل'}
        </Button>
      </div>

      {preview ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={preview.validCount > 0 ? 'success' : 'muted'}>
              <CheckCircle2 aria-hidden className="mr-1 h-3.5 w-3.5" /> {faDigits(preview.validCount)} ردیف معتبر
            </Badge>
            <Badge tone={preview.invalidCount > 0 ? 'warning' : 'muted'}>
              <AlertTriangle aria-hidden className="mr-1 h-3.5 w-3.5" /> {faDigits(preview.invalidCount)} ردیف نیازمند اصلاح
            </Badge>
            <span className="text-xs text-slate-500">هیچ‌چیز هنوز ثبت نشده است.</span>
          </div>

          {preview.invalid.length > 0 ? (
            <Alert variant="warning">
              <p className="mb-1 font-medium">ردیف‌های رد‌شده (اصلاح و دوباره بارگذاری کنید):</p>
              <ul className="space-y-0.5 text-xs">
                {preview.invalid.slice(0, 20).map((row) => (
                  <li key={row.row}>
                    ردیف {faDigits(row.row)}: {row.errors.join(' ')}
                  </li>
                ))}
                {preview.invalid.length > 20 ? <li>… و {faDigits(preview.invalid.length - 20)} ردیف دیگر</li> : null}
              </ul>
            </Alert>
          ) : null}

          {preview.valid.length > 0 ? (
            <div className="max-h-72 overflow-auto rounded border border-slate-200 dark:border-slate-800">
              <Table head={['ردیف', 'نام', 'ایمیل', 'دپارتمان', 'نقش‌ها', 'وضعیت']}>
                {preview.valid.map((r) => (
                  <tr key={r.rowNumber}>
                    <Td className="tabular">{faDigits(r.rowNumber)}</Td>
                    <Td>{r.name}</Td>
                    <Td dir="ltr" className="text-xs">{r.email}</Td>
                    <Td>{r.departmentName ?? '—'}</Td>
                    <Td className="text-xs">{r.roleNames.join('، ') || '—'}</Td>
                    <Td><Badge tone={r.status === 'active' ? 'success' : 'muted'}>{STATUS_FA[r.status] ?? r.status}</Badge></Td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : null}

          <Button type="button" disabled={busy || preview.validCount === 0} onClick={() => void confirm()}>
            <FileSpreadsheet aria-hidden className="h-4 w-4" /> {busy ? 'در حال ثبت…' : `ثبت ${faDigits(preview.validCount)} کاربر`}
          </Button>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <Alert variant={result.failed > 0 ? 'warning' : 'success'}>
            {faDigits(result.created)} کاربر ثبت شد
            {result.failed > 0 ? ` و ${faDigits(result.failed)} ردیف ثبت نشد.` : '.'}
          </Alert>
          {result.errors.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-rose-600 dark:text-rose-400">
              {result.errors.map((e) => (
                <li key={`${e.row}-${e.message}`}>ردیف {faDigits(e.row)}: {e.message}</li>
              ))}
            </ul>
          ) : null}

          {result.credentials.length > 0 ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <p className="mb-2 font-medium text-amber-900 dark:text-amber-200">
                رمز یک‌بارمصرف {faDigits(result.credentials.length)} کاربر ساخته شد؛ همین حالا ذخیره کنید — دیگر نمایش داده نمی‌شود.
              </p>
              <div className="max-h-56 overflow-auto">
                <Table head={['نام', 'ایمیل', 'رمز']}>
                  {result.credentials.map((c) => (
                    <tr key={c.email}>
                      <Td>{c.name}</Td>
                      <Td dir="ltr" className="text-xs">{c.email}</Td>
                      <Td dir="ltr" className="font-mono text-xs">{c.password}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() =>
                  downloadCsv(
                    'user-credentials.csv',
                    ['نام', 'ایمیل', 'رمز عبور'],
                    result.credentials.map((c) => [c.name, c.email, c.password]),
                  )
                }
              >
                <Download aria-hidden className="h-4 w-4" /> دانلود فایل رمزها (CSV)
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
