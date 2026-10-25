import Link from 'next/link';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { faDigits } from '@/lib/format';
import { cn } from '@pe/ui';

/**
 * Server-rendered pagination. Links keep the app in client-side navigation
 * (no full page reload), so paging behaves like an AJAX update.
 */
export function Pagination({
  page,
  perPage,
  total,
  basePath,
  params = {},
}: {
  page: number;
  perPage: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set('page', String(p));
    sp.set('perPage', String(perPage));
    return `${basePath}?${sp.toString()}`;
  };

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const linkCls = (disabled: boolean) =>
    cn(
      'inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm',
      disabled
        ? 'pointer-events-none border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600'
        : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
    );

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800" aria-label="صفحه‌بندی">
      <span>نمایش {faDigits(from)}–{faDigits(to)} از {faDigits(total)}</span>
      <div className="flex items-center gap-2">
        <Link href={href(page - 1)} aria-disabled={page <= 1} className={linkCls(page <= 1)}>
          <ChevronRight aria-hidden className="h-4 w-4" /> قبلی
        </Link>
        <span className="tabular">صفحه {faDigits(page)} از {faDigits(pages)}</span>
        <Link href={href(page + 1)} aria-disabled={page >= pages} className={linkCls(page >= pages)}>
          بعدی <ChevronLeft aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  );
}
