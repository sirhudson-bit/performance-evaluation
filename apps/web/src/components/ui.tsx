import * as React from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { cn } from '@pe/ui';
import { labelOf, toneOf, type Tone } from '@pe/shared/enums';

/**
 * Design-system primitives for the web app.
 *
 * The visual language follows the shadcn/ui component model (CVA-style
 * variants, a single `cn` merge, logical RTL spacing) without pulling a second
 * styling runtime into the project. Radix primitives power the interactive
 * pieces in `components/ui/dialog` and `components/ui/dropdown-menu`.
 */

const toneClass: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  info: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300',
  muted: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
};

const toneDot: Record<Tone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-brand-500',
  muted: 'bg-slate-400',
};

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900/80',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('px-5 py-5', className)}>{children}</div>;
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 focus-visible:ring-brand-500/25',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  outline:
    'border border-brand-200 bg-transparent text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/40',
  danger: 'bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
};

type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-sm',
  icon: 'h-10 w-10 rounded-xl',
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Badge({ tone = 'muted', children, dot = true }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none',
        toneClass[tone],
      )}
    >
      {dot ? <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', toneDot[tone])} /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Status badge for a given enum group — always pairs colour with text (WCAG 1.4.1). */
export function StatusBadge({ group, value }: { group: Parameters<typeof labelOf>[0]; value: string | null | undefined }) {
  return <Badge tone={toneOf(group, value)}>{labelOf(group, value)}</Badge>;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {required ? <span className="ms-0.5 text-rose-600">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {error ? (
        <p className="text-[11px] font-medium leading-5 text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'block h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:disabled:bg-slate-900';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} {...props} className={cn(inputClass, className)} />;
  },
);

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'h-auto min-h-28 resize-y py-3 leading-7', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, 'cursor-pointer pe-9', props.className)} />;
}

export function Alert({ variant = 'info', children }: { variant?: Tone; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm leading-6', toneClass[variant])} role="status">
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Inbox aria-hidden className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  tone = 'muted',
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="group relative p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 tabular dark:text-slate-50">{value}</p>
        </div>
        {icon ? (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', toneClass[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-3">
          <Badge tone={tone}>{hint}</Badge>
        </div>
      ) : null}
    </Card>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-gradient-to-l from-brand-500 to-sky-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {label ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{label}</p> : null}
    </div>
  );
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-right text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
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

export function Td({
  children,
  className,
  dir,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl';
  colSpan?: number;
}) {
  return (
    <td dir={dir} colSpan={colSpan} className={cn('px-4 py-3.5 align-middle text-slate-700 dark:text-slate-200', className)}>
      {children}
    </td>
  );
}
