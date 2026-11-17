'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { ExcelDropzone } from '@/components/ExcelDropzone';

function StepNumber({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}

/**
 * Shared three-step intro for the two Excel import flows.
 *
 * Keeping the template download, dropzone and review action in one vertical
 * card fixes the old RTL reading order (download is step 1 on the right) and
 * gives both importers exactly the same structure and spacing.
 */
export function ExcelImportIntro({
  id,
  file,
  onFile,
  onError,
  disabled,
  busy,
  onCheck,
  templateHref,
  templateBody,
  dropHint,
  reviewText,
}: {
  id: string;
  file: File | null;
  onFile: (file: File | null) => void;
  onError?: (message: string | null) => void;
  disabled?: boolean;
  busy?: boolean;
  onCheck: () => void;
  templateHref: string;
  templateBody: string;
  dropHint: string;
  reviewText: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <StepNumber>۱</StepNumber>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100">قالب اکسل را دانلود کنید</p>
            <p className="mt-1 max-w-2xl text-[11px] leading-6 text-slate-500 dark:text-slate-400">{templateBody}</p>
          </div>
        </div>
        <a
          href={templateHref}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
        >
          <Download aria-hidden className="h-3.5 w-3.5" />
          دانلود قالب اکسل
        </a>
      </div>

      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        <div className="mb-3 flex items-start gap-3">
          <StepNumber>۲</StepNumber>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100">فایل تکمیل‌شده را بارگذاری کنید</p>
            <p className="mt-1 text-[11px] leading-6 text-slate-500 dark:text-slate-400">
              فقط فایل xlsx پذیرفته می‌شود؛ ردیف‌های نامعتبر در مرحله بررسی مشخص می‌شوند.
            </p>
          </div>
        </div>
        <ExcelDropzone
          id={id}
          file={file}
          onFile={onFile}
          onError={onError}
          disabled={disabled || busy}
          hint={dropHint}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/30">
        <div className="flex min-w-0 items-start gap-3">
          <StepNumber>۳</StepNumber>
          <p className="pt-1 text-[11px] leading-6 text-slate-500 dark:text-slate-400">{reviewText}</p>
        </div>
        <Button type="button" disabled={disabled || busy || !file} onClick={onCheck}>
          {busy ? 'در حال بررسی…' : 'بررسی فایل'}
        </Button>
      </div>
    </div>
  );
}
