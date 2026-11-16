'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ANSWER_TYPES } from '@pe/shared';
import { apiClient, apiUpload, ApiClientError } from '@/lib/client';
import { Alert, Badge, Button, Field, Table, Td, Input } from '@/components/ui';
import { faDigits } from '@/lib/format';

interface Option { label: string; value: string; score: number | null; isNotApplicable: boolean; sortOrder: number }

interface ParsedRow {
  rowNumber: number;
  categoryName?: string;
  stableKey: string;
  title: string;
  text: string;
  guidance?: string;
  answerType: string;
  weight: number;
  required: boolean;
  options: Option[];
  scoring: Record<string, unknown>;
  respondentRoles: string[];
  subjectType: string;
  status: string;
  sortOrder: number;
}

interface Preview {
  validCount: number;
  invalidCount: number;
  valid: ParsedRow[];
  invalid: { row: number; errors: string[]; raw: string[] }[];
  newCategories: string[];
  limits: { maxRows: number };
}

interface ConfirmResult {
  created: number;
  failed: number;
  categoriesCreated: number;
  errors: { row: number; message: string }[];
}

/**
 * Bulk question import. The template carries this organization's categories and
 * dropdown-validated answer types; the preview shows the normalized stable key
 * and the options that will actually be written before anything is saved.
 */
export function QuestionImportCard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [createCategories, setCreateCategories] = useState(true);
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
      const data = await apiUpload<Preview>('/questions/import/preview', form);
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
      const data = await apiClient<ConfirmResult>('POST', '/questions/import/confirm', {
        createMissingCategories: createCategories,
        rows: preview.valid.map((r) => ({
          stableKey: r.stableKey,
          title: r.title,
          text: r.text,
          guidance: r.guidance,
          answerType: r.answerType,
          weight: r.weight,
          required: r.required,
          options: r.options,
          scoring: r.scoring,
          respondentRoles: r.respondentRoles,
          subjectType: r.subjectType,
          status: r.status,
          sortOrder: r.sortOrder,
          categoryName: r.categoryName,
        })),
      });
      setResult(data);
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در ثبت پرسش‌ها.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-3">
        <a
          href="/api/v1/questions/import/template"
          className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Download aria-hidden className="h-4 w-4" /> دانلود قالب اکسل
        </a>
        <Field label="فایل تکمیل‌شده" htmlFor="questions-import-file" hint="قالب را پر کنید و همان فایل xlsx را اینجا بگذارید.">
          <Input
            id="questions-import-file"
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
              <CheckCircle2 aria-hidden className="mr-1 h-3.5 w-3.5" /> {faDigits(preview.validCount)} پرسش معتبر
            </Badge>
            <Badge tone={preview.invalidCount > 0 ? 'warning' : 'muted'}>
              <AlertTriangle aria-hidden className="mr-1 h-3.5 w-3.5" /> {faDigits(preview.invalidCount)} ردیف نیازمند اصلاح
            </Badge>
            <span className="text-xs text-slate-500">هیچ‌چیز هنوز ثبت نشده است.</span>
          </div>

          {preview.newCategories.length > 0 ? (
            <Alert variant="info">
              دسته‌های جدید که ساخته می‌شوند: {preview.newCategories.join('، ')}
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={createCategories} onChange={(e) => setCreateCategories(e.target.checked)} />
                ساخت خودکار دسته‌های جدید
              </label>
            </Alert>
          ) : null}

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
              <Table head={['ردیف', 'شناسه پایدار', 'عنوان', 'دسته', 'نوع پاسخ', 'گزینه‌ها', 'وزن']}>
                {preview.valid.map((r) => (
                  <tr key={r.rowNumber}>
                    <Td className="tabular">{faDigits(r.rowNumber)}</Td>
                    <Td dir="ltr" className="font-mono text-xs">{r.stableKey}</Td>
                    <Td>{r.title}</Td>
                    <Td>{r.categoryName ?? '—'}</Td>
                    <Td className="text-xs">{ANSWER_TYPES[r.answerType as keyof typeof ANSWER_TYPES] ?? r.answerType}</Td>
                    <Td className="tabular text-xs">{r.options.length > 0 ? faDigits(r.options.length) : '—'}</Td>
                    <Td className="tabular">{faDigits(r.weight)}</Td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : null}

          <Button type="button" disabled={busy || preview.validCount === 0} onClick={() => void confirm()}>
            <FileSpreadsheet aria-hidden className="h-4 w-4" /> {busy ? 'در حال ثبت…' : `ثبت ${faDigits(preview.validCount)} پرسش`}
          </Button>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-2">
          <Alert variant={result.failed > 0 ? 'warning' : 'success'}>
            {faDigits(result.created)} پرسش ثبت شد
            {result.categoriesCreated > 0 ? ` و ${faDigits(result.categoriesCreated)} دسته جدید ساخته شد` : ''}
            {result.failed > 0 ? `؛ ${faDigits(result.failed)} ردیف ثبت نشد.` : '.'}
          </Alert>
          {result.errors.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-rose-600 dark:text-rose-400">
              {result.errors.map((e) => (
                <li key={`${e.row}-${e.message}`}>ردیف {faDigits(e.row)}: {e.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
