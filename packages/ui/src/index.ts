/**
 * Framework-agnostic UI helpers and design tokens.
 *
 * The React component primitives live in the web app (`apps/web/src/components/ui`)
 * because they depend on the Next.js/React runtime; this package holds the
 * shared, dependency-light pieces: the class-name merger and the design tokens
 * that keep spacing, radii and status colours identical everywhere.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, de-duplicating conflicting Tailwind classes. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const RADIUS = '15px';

export const STATUS_TONES = {
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  danger: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  muted: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
} as const;

export type StatusToneName = keyof typeof STATUS_TONES;

/** Accessible status badge classes (never colour-only — always paired with text). */
export function toneClasses(tone: StatusToneName): string {
  const t = STATUS_TONES[tone];
  return `${t.bg} ${t.text} ${t.border}`;
}
