/**
 * Shared Zod schemas.
 *
 * These are the single source of validation truth for both the API and the web
 * app, so a rule can never disagree between the two. Server-side validation is
 * authoritative; the client reuses the same schema for immediate feedback.
 */

import { z } from 'zod';

// --- primitives ------------------------------------------------------------

export const idParam = z.coerce.number().int().positive();

export const idParamString = z.string().regex(/^\d+$/, 'شناسه معتبر نیست.');

/** Standards-compliant email (not an over-restrictive hand-rolled regex). */
export const email = z.string().trim().toLowerCase().email('ایمیل معتبر نیست.');

/** Persian personal-name: Persian letters, ZWNJ and spaces only. */
export const persianName = z
  .string()
  .trim()
  .min(2, 'نام باید حداقل ۲ حرف باشد.')
  .max(80, 'نام بیش از حد طولانی است.')
  .regex(/^[\u0600-\u06FF\u200c\s]+$/u, 'فقط حروف فارسی، فاصله و نیم‌فاصله مجاز است.');

/** Password policy: at least 8 chars with a letter and a digit (any script). */
export const password = z
  .string()
  .min(8, 'رمز عبور باید حداقل ۸ نویسه باشد.')
  .max(200, 'رمز عبور بیش از حد طولانی است.')
  .regex(/\p{L}/u, 'رمز عبور باید حداقل یک حرف داشته باشد.')
  .regex(/\p{Nd}/u, 'رمز عبور باید حداقل یک رقم داشته باشد.');

/** Optional Iranian phone, validated only when a value is provided. */
export const optionalPhone = z
  .string()
  .trim()
  .regex(/^0?9\d{9}$/, 'شماره تلفن همراه معتبر نیست.')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const nonEmptyString = z.string().trim().min(1, 'این فیلد الزامی است.');

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const searchQuery = pagination.extend({
  q: z.string().trim().max(120).optional(),
});

/** A Jalali/Gregorian ISO date string accepted as a Date. */
export const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'تاریخ معتبر نیست.')
  .transform((v) => new Date(v));

export const jsonObject = z.record(z.any());

export type Pagination = z.infer<typeof pagination>;
