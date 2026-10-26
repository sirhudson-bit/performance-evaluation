import { z } from 'zod';
import { email, password, persianName, optionalPhone } from './common.js';

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'رمز عبور را وارد کنید.').max(200),
  totp: z.string().trim().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'رمز عبور فعلی را وارد کنید.'),
  newPassword: password,
});

export const requestPasswordResetSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'توکن بازیابی معتبر نیست.'),
  newPassword: password,
});

export const updateProfileSchema = z.object({
  name: persianName.optional(),
  phone: optionalPhone,
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
});

export const mfaCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'کد شش‌رقمی را وارد کنید.'),
});

/** Request a one-time login code by email (sent as an SMS to the stored phone). */
export const otpRequestSchema = z.object({ email });

/** Verify a one-time login code. Persian digits are normalised in the API. */
export const otpVerifySchema = z.object({
  email,
  code: z
    .string()
    .trim()
    .regex(/^[0-9۰-۹]{6}$/, 'کد شش‌رقمی را وارد کنید.'),
});

export const consentSchema = z.object({
  categories: z.record(z.boolean()),
  policyVersion: z.string().max(20).default('1.0'),
});

export const tourProgressSchema = z.object({
  tourKey: z.string().min(1).max(60),
  status: z.enum(['pending', 'done', 'dismissed']),
});

export type LoginInput = z.infer<typeof loginSchema>;
