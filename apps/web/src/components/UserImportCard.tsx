'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Users } from 'lucide-react';
import { apiClient, apiUpload, ApiClientError } from '@/lib/client';
import { Alert, Badge, Button, Card, Table, Td } from '@/components/ui';
import { ExcelImportIntro } from '@/components/ExcelImportIntro';
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
 * Excel import for users. The file is parsed and validated server-side into a
 * preview, and nothing is written until the operator confirms. The visual shell
 * is shared with the question importer via ExcelDropzone and the same summary
 * cards, so both flows read as one product.
 */
export function UserImportCard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }

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
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در ثبت کاربران.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {!preview && !result ? (
        <ExcelImportIntro
          id="users-import-file"
          file={file}
          onFile={(next) => {
            setFile(next);
            setPreview(null);
            setResult(null);
          }}
          onError={setError}
          busy={busy}
          onCheck={() => void check()}
          templateHref="/api/v1/users/import/template"
          templateBody="قالب بر اساس دپارتمان‌ها و نقش‌های همین سازمان ساخته می‌شود. ستون‌های اجباری با رنگ مشخص شده‌اند."
          dropHint="فایل کاربران را با پسوند xlsx انتخاب کنید؛ حداکثر ۲۰ مگابایت و ۳۰۰ ردیف."
          reviewText="فایل ابتدا فقط بررسی می‌شود؛ تا تأیید نهایی هیچ کاربری ساخته نمی‌شود."
        />
      ) : null}

      {preview ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <FileSpreadsheet aria-hidden className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">{file?.name ?? 'فایل انتخاب‌شده'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">پیش‌نمایش فایل — هنوز چیزی ثبت نشده است.</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              انتخاب فایل دیگر
            </Button>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> ردیف‌های معتبر
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular text-emerald-800 dark:text-emerald-200">{faDigits(preview.validCount)}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle aria-hidden className="h-3.5 w-3.5" /> نیازمند اصلاح
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular text-amber-800 dark:text-amber-200">{faDigits(preview.invalidCount)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  <Users aria-hidden className="h-3.5 w-3.5" /> کل ردیف‌ها
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular text-slate-800 dark:text-slate-100">{faDigits(preview.validCount + preview.invalidCount)}</p>
              </div>
            </div>

            {preview.invalid.length > 0 ? (
              <Alert variant="warning">
                <p className="mb-1.5 font-bold">ردیف‌های رد‌شده — اصلاح و دوباره بارگذاری کنید:</p>
                <ul className="space-y-1 text-xs">
                  {preview.invalid.slice(0, 20).map((row) => (
                    <li key={row.row}>
                      <span className="font-semibold">ردیف {faDigits(row.row)}:</span> {row.errors.join(' ')}
                    </li>
                  ))}
                  {preview.invalid.length > 20 ? <li>… و {faDigits(preview.invalid.length - 20)} ردیف دیگر</li> : null}
                </ul>
              </Alert>
            ) : null}

            {preview.valid.length > 0 ? (
              <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <Table head={['ردیف', 'نام', 'ایمیل', 'دپارتمان', 'نقش‌ها', 'وضعیت']}>
                  {preview.valid.map((r) => (
                    <tr key={r.rowNumber} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <Td className="tabular text-xs">{faDigits(r.rowNumber)}</Td>
                      <Td className="text-[13px] font-semibold">{r.name}</Td>
                      <Td dir="ltr" className="text-right text-xs">{r.email}</Td>
                      <Td className="text-xs">{r.departmentName ?? '—'}</Td>
                      <Td className="text-xs">{r.roleNames.join('، ') || '—'}</Td>
                      <Td><Badge tone={r.status === 'active' ? 'success' : 'muted'}>{STATUS_FA[r.status] ?? r.status}</Badge></Td>
                    </tr>
                  ))}
                </Table>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {preview.validCount === 0 ? 'هیچ ردیف قابل ثبتی پیدا نشد؛ فایل را تکمیل و دوباره بررسی کنید.' : preview.invalidCount > 0 ? 'ردیف‌های نامعتبر نادیده گرفته می‌شوند؛ فقط ردیف‌های معتبر ثبت می‌شوند.' : 'همه ردیف‌ها معتبرند و آماده ثبت هستند.'}
              </p>
              <Button type="button" disabled={busy || preview.validCount === 0} onClick={() => void confirm()}>
                <FileSpreadsheet aria-hidden className="h-4 w-4" />
                {busy ? 'در حال ثبت…' : `ثبت ${faDigits(preview.validCount)} کاربر`}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {result ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 aria-hidden className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {faDigits(result.created)} کاربر ثبت شد
                  {result.failed > 0 ? ` و ${faDigits(result.failed)} ردیف ثبت نشد.` : '.'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">نتیجه در فهرست کاربران اعمال شد.</p>
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={reset}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              فایل جدید
            </Button>
          </div>

          {result.errors.length > 0 ? (
            <Alert variant="warning">
              <ul className="space-y-0.5 text-xs">
                {result.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>ردیف {faDigits(e.row)}: {e.message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {result.credentials.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="mb-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                رمز یک‌بارمصرف {faDigits(result.credentials.length)} کاربر ساخته شد؛ همین حالا ذخیره کنید — دیگر نمایش داده نمی‌شود.
              </p>
              <div className="max-h-56 overflow-auto rounded-lg border border-amber-200 bg-white dark:border-amber-900 dark:bg-slate-900">
                <Table head={['نام', 'ایمیل', 'رمز']}>
                  {result.credentials.map((c) => (
                    <tr key={c.email}>
                      <Td className="text-xs">{c.name}</Td>
                      <Td dir="ltr" className="text-right text-xs">{c.email}</Td>
                      <Td dir="ltr" className="font-mono text-xs">{c.password}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() =>
                  downloadCsv(
                    'user-credentials.csv',
                    ['نام', 'ایمیل', 'رمز عبور'],
                    result.credentials.map((c) => [c.name, c.email, c.password]),
                  )
                }
              >
                <Download aria-hidden className="h-3.5 w-3.5" /> دانلود فایل رمزها (CSV)
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
