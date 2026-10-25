import * as React from 'react';
import Link from 'next/link';
import { cn } from '@pe/ui';
import { labelOf, toneOf, type Tone } from '@pe/shared/enums';

/** Presentational primitives (server-safe; no hooks). Dark-mode aware. */

const toneClass: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  info: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900',
  muted: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded border border-slate-200 bg-surface shadow-card dark:border-slate-800 dark:bg-slate-900', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({ href, variant = 'primary', className, children }: { href: string; variant?: ButtonVariant; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn('inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition', buttonVariants[variant], className)}>
      {children}
    </Link>
  );
}

export function Badge({ tone = 'muted', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium', toneClass[tone])}>{children}</span>;
}

/** Status badge for a given enum group — always pairs colour with text (WCAG 1.4.1). */
export function StatusBadge({ group, value }: { group: Parameters<typeof labelOf>[0]; value: string | null | undefined }) {
  return <Badge tone={toneOf(group, value)}>{labelOf(group, value)}</Badge>;
}

export function Field({ label, htmlFor, hint, error, required, children }: { label: string; htmlFor?: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-500">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'min-h-24', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, props.className)} />;
}

export function Alert({ variant = 'info', children }: { variant?: Tone; children: React.ReactNode }) {
  return (
    <div className={cn('rounded border px-4 py-3 text-sm', toneClass[variant])} role="status">
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description ? <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiTile({ label, value, hint, tone = 'muted' }: { label: string; value: React.ReactNode; hint?: string; tone?: Tone }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular text-slate-900 dark:text-slate-100">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-slate-400">
          <Badge tone={tone}>{hint}</Badge>
        </p>
      ) : null}
    </Card>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
      {label ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p> : null}
    </div>
  );
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-right text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, dir }: { children: React.ReactNode; className?: string; dir?: 'ltr' | 'rtl' }) {
  return <td dir={dir} className={cn('px-4 py-3 text-slate-700 dark:text-slate-200', className)}>{children}</td>;
}
