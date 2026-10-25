'use client';

import { useMemo } from 'react';
import { toJalaali, toGregorian, isLeapJalaaliYear } from 'jalaali-js';

/** Solar Hijri (Jalali) date input — replaces native Gregorian date pickers. */

const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function monthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}

export function JalaliDateInput({
  id,
  value,
  onChange,
  required,
  disabled,
}: {
  id?: string;
  value: string | null; // ISO (Gregorian) date string
  onChange: (iso: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const { jy, jm, jd } = useMemo(() => {
    const d = value ? new Date(value) : new Date();
    const src = Number.isNaN(d.getTime()) ? new Date() : d;
    return toJalaali(src.getFullYear(), src.getMonth() + 1, src.getDate());
  }, [value]);

  const today = toJalaali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
  const years: number[] = [];
  for (let y = today.jy - 6; y <= today.jy + 6; y += 1) years.push(y);
  if (!years.includes(jy)) years.push(jy);
  years.sort((a, b) => a - b);

  const days: number[] = [];
  for (let d = 1; d <= monthLength(jy, jm); d += 1) days.push(d);

  function emit(nextY: number, nextM: number, nextD: number) {
    const clampedDay = Math.min(nextD, monthLength(nextY, nextM));
    const { gy, gm, gd } = toGregorian(nextY, nextM, clampedDay);
    onChange(`${gy}-${pad2(gm)}-${pad2(gd)}`);
  }

  return (
    <div className="flex gap-2" id={id}>
      <select
        aria-label="روز"
        disabled={disabled}
        value={jd}
        onChange={(e) => emit(jy, jm, Number(e.target.value))}
        className="rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        {days.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select
        aria-label="ماه"
        disabled={disabled}
        value={jm}
        onChange={(e) => emit(jy, Number(e.target.value), jd)}
        className="flex-1 rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        {MONTHS.map((m, i) => (
          <option key={i + 1} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        aria-label="سال"
        disabled={disabled}
        value={jy}
        onChange={(e) => emit(Number(e.target.value), jm, jd)}
        className="rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      {required ? <span className="sr-only">الزامی</span> : null}
    </div>
  );
}
