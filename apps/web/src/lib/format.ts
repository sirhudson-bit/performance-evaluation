import { toJalaali, toGregorian } from 'jalaali-js';
import { labelOf, toneOf, type Tone } from '@pe/shared/enums';

/**
 * Display formatting shared by every page: Persian numerals and the Jalali
 * calendar live here so a number or date can never be rendered two ways.
 * Timestamps are stored in UTC and converted for display only.
 */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

type Numeric = string | number | { toString(): string } | null | undefined;

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export function faDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

export function enDigits(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
}

export function formatNumber(value: Numeric): string {
  const n = toNumber(value);
  if (n === null) return '—';
  return faDigits(n.toLocaleString('en-US'));
}

export function formatScore(value: Numeric): string {
  const n = toNumber(value);
  if (n === null) return '—';
  return faDigits(n.toFixed(2));
}

export function formatPercent(value: Numeric): string {
  const n = toNumber(value);
  if (n === null) return '—';
  return `${faDigits(n.toFixed(1))}٪`;
}

export function formatMoney(value: Numeric, currency = 'IRT'): string {
  const n = toNumber(value);
  if (n === null) return '—';
  const grouped = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const unit = currency === 'IRR' ? 'ریال' : currency === 'IRT' ? 'تومان' : currency;
  return `${faDigits(grouped)} ${unit}`;
}

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function formatJalali(value: string | Date | null | undefined, opts: { withTime?: boolean } = {}): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(opts.withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const gregorian = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  const { jy, jm, jd } = toJalaali(gregorian.getUTCFullYear(), gregorian.getUTCMonth() + 1, gregorian.getUTCDate());

  const base = `${faDigits(jy)}/${faDigits(pad2(jm))}/${faDigits(pad2(jd))}`;
  return opts.withTime ? `${base} - ${faDigits(pad2(get('hour')))}:${faDigits(pad2(get('minute')))}` : base;
}

export function formatJalaliLong(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const gregorian = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  const { jy, jm, jd } = toJalaali(gregorian.getFullYear(), gregorian.getMonth() + 1, gregorian.getDate());
  return `${faDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${faDigits(jy)}`;
}

/** Converts a Jalali y/m/d selection to the Gregorian ISO date used for queries. */
export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}

export { labelOf as statusLabel, toneOf as statusTone };
export type { Tone };
