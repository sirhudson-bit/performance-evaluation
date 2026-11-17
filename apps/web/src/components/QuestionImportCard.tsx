'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Layers, RotateCcw } from 'lucide-react';
import { ANSWER_TYPES } from '@pe/shared';
import { apiClient, apiUpload, ApiClientError } from '@/lib/client';
import { Alert, Button, Card, Table, Td } from '@/components/ui';
import { ExcelImportIntro } from '@/components/ExcelImportIntro';
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
 * Bulk question import. Uses the same dropzone, summary cards and preview shell
 * as the user importer so the two Excel flows are visually identical.
 */
export function QuestionImportCard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [createCategories, setCreateCategories] = useState(true);
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
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در ثبت پرسش‌ها.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {!preview && !result ? (
        <ExcelImportIntro
          id="questions-import-file"
          file={file}
          onFile={(next) => {
            setFile(next);
            setPreview(null);
            setResult(null);
          }}
          onError={setError}
          busy={busy}
          onCheck={() => void check()}
          templateHref="/api/v1/questions/import/template"
          templateBody="قالب شامل دسته‌های موجود، نوع پاسخ‌ها و ستون گزینه‌هاست. هر ردیف یک پرسش با شناسه پایدار یکتا."
          dropHint="فایل پرسش‌ها را با پسوند xlsx انتخاب کنید؛ حداکثر ۲۰ مگابایت و ۵۰۰ پرسش."
          reviewText="فایل ابتدا فقط بررسی می‌شود؛ تا تأیید نهایی هیچ پرسشی ساخته نمی‌شود."
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
                  <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> پرسش‌های معتبر
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
                  <Layers aria-hidden className="h-3.5 w-3.5" /> دسته‌های جدید
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular text-slate-800 dark:text-slate-100">{faDigits(preview.newCategories.length)}</p>
              </div>
            </div>

            {preview.newCategories.length > 0 ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 text-sm dark:border-brand-900 dark:bg-brand-950/30">
                <p className="text-xs font-semibold text-brand-800 dark:text-brand-200">
                  دسته‌های جدید: {preview.newCategories.join('، ')}
                </p>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-brand-700 dark:text-brand-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                    checked={createCategories}
                    onChange={(e) => setCreateCategories(e.target.checked)}
                  />
                  ساخت خودکار دسته‌های جدید هنگام ثبت
                </label>
              </div>
            ) : null}

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
                <Table head={['ردیف', 'شناسه پایدار', 'عنوان', 'دسته', 'نوع پاسخ', 'گزینه‌ها', 'وزن']}>
                  {preview.valid.map((r) => (
                    <tr key={r.rowNumber} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <Td className="tabular text-xs">{faDigits(r.rowNumber)}</Td>
                      <Td dir="ltr" className="text-right font-mono text-xs">{r.stableKey}</Td>
                      <Td className="text-[13px] font-semibold">{r.title}</Td>
                      <Td className="text-xs">{r.categoryName ?? '—'}</Td>
                      <Td className="text-xs">{ANSWER_TYPES[r.answerType as keyof typeof ANSWER_TYPES] ?? r.answerType}</Td>
                      <Td className="tabular text-xs">{r.options.length > 0 ? faDigits(r.options.length) : '—'}</Td>
                      <Td className="tabular text-xs">{faDigits(r.weight)}</Td>
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
                {busy ? 'در حال ثبت…' : `ثبت ${faDigits(preview.validCount)} پرسش`}
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
                  {faDigits(result.created)} پرسش ثبت شد
                  {result.categoriesCreated > 0 ? ` و ${faDigits(result.categoriesCreated)} دسته جدید ساخته شد` : ''}
                  {result.failed > 0 ? `؛ ${faDigits(result.failed)} ردیف ثبت نشد.` : '.'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">بانک پرسش‌ها به‌روزرسانی شد.</p>
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
        </div>
      ) : null}
    </div>
  );
}
