'use client';

import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { cn } from '@pe/ui';
import { faDigits } from '@/lib/format';

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${faDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faDigits(Math.round(bytes / 1024))} کیلوبایت`;
  return `${faDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

/**
 * Shared Excel file picker for the bulk-import panels.
 *
 * The browser's native file control renders an English "No file chosen" label
 * and ignores the app's type scale. This dropzone keeps the real input
 * accessible but visually hidden, and renders the selected file as a proper
 * chip with size, replacement and removal controls.
 */
export function ExcelDropzone({
  id,
  file,
  onFile,
  onError,
  disabled,
  hint,
}: {
  id: string;
  file: File | null;
  onFile: (file: File | null) => void;
  onError?: (message: string | null) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = '';
  }, [file]);

  function acceptFile(next: File | null) {
    if (!next) {
      onFile(null);
      return;
    }
    if (!next.name.toLowerCase().endsWith('.xlsx')) {
      onError?.('فقط فایل اکسل با پسوند xlsx پذیرفته می‌شود.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (next.size < 1024) {
      onError?.('فایل خالی یا معتبر نیست؛ قالب اکسل را دوباره دانلود و تکمیل کنید.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (next.size > 20 * 1024 * 1024) {
      onError?.('حجم فایل نباید بیشتر از ۲۰ مگابایت باشد.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    onError?.(null);
    onFile(next);
  }

  return (
    <div
      className={cn(
        'flex min-h-[13rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
        dragging
          ? 'border-brand-400 bg-brand-50/70 dark:border-brand-700 dark:bg-brand-950/30'
          : 'border-slate-200 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-brand-800',
        disabled && 'pointer-events-none opacity-60',
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) acceptFile(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        disabled={disabled}
        aria-label="انتخاب فایل اکسل"
        onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="w-full max-w-sm space-y-3">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <FileSpreadsheet aria-hidden className="h-6 w-6" />
          </span>
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-right shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">{file.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">فایل اکسل · {sizeLabel(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFile(null);
                }}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                aria-label="حذف فایل انتخاب‌شده"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              تغییر فایل
            </button>
            <span aria-hidden>·</span>
            <span>برای بررسی، دکمه پایین را بزنید</span>
          </div>
        </div>
      ) : (
        <>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-brand-300 dark:ring-slate-700">
            <UploadCloud aria-hidden className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">فایل اکسل را اینجا رها کنید</p>
          <p className="mt-1 max-w-xs text-[11px] leading-6 text-slate-500 dark:text-slate-400">
            {hint ?? 'یا فایل xlsx را از دستگاه انتخاب کنید؛ حداکثر ۲۰ مگابایت.'}
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-800 dark:hover:bg-brand-950/40"
          >
            <FileSpreadsheet aria-hidden className="h-4 w-4" />
            انتخاب فایل
          </button>
        </>
      )}
    </div>
  );
}
