'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@pe/ui';
import { inputClass } from './ui';

/**
 * Password input with an explicit show/hide control.
 *
 * The button is `type="button"` so it never submits the surrounding form, and
 * `aria-pressed` tells screen readers whether the value is currently visible.
 * The field keeps `dir="ltr"` by default because passwords are Latin text even
 * in the Persian UI; the icon sits on the physical right so it never covers the
 * first character.
 */
export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        dir={props.dir ?? 'ltr'}
        className={cn(inputClass, 'pr-10', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
        aria-pressed={visible}
        title={visible ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-l text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:text-slate-200"
        tabIndex={0}
      >
        {visible ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
      </button>
    </div>
  );
}
