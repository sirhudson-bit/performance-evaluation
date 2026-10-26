import { z } from 'zod';

/** Mobile number as entered in Iran; the API normalises it to `09xxxxxxxxx`. */
export const mobilePhone = z
  .string()
  .trim()
  .regex(/^(\+?98|0098|0)?9\d{9}$/, 'شماره تلفن همراه معتبر نیست (مثال: 09121234567).');

/**
 * MeliPayamak connection settings. The password is write-only: an empty value
 * on update means "keep the stored secret", and it is never returned by the API.
 */
export const smsSettingsSchema = z.object({
  enabled: z.boolean(),
  username: z.string().trim().max(120).default(''),
  password: z.string().max(200).optional(),
  from: z
    .string()
    .trim()
    .regex(/^\d{3,20}$/, 'شماره خط ارسال باید فقط رقم باشد.')
    .optional()
    .or(z.literal('')),
  baseUrl: z.string().trim().url('آدرس وب‌سرویس معتبر نیست.').max(300).optional(),
  otpEnabled: z.boolean().default(true),
  otpText: z.string().trim().min(5, 'متن پیامک کد ورود را وارد کنید.').max(200).default('کد ورود شما: {code}'),
  otpPatternId: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, 'شناسه الگو باید عدد باشد.')
    .optional()
    .or(z.literal('')),
});

export const smsTestSchema = z.object({ to: mobilePhone });

export const smsSendSchema = z.object({
  audience: z.enum(['all', 'managers', 'staff', 'user']),
  userId: z.coerce.number().int().positive().optional(),
  text: z.string().trim().min(1, 'متن پیام را وارد کنید.').max(500, 'متن پیام حداکثر ۵۰۰ نویسه است.'),
});

export type SmsSettingsInput = z.infer<typeof smsSettingsSchema>;
export type SmsSendInput = z.infer<typeof smsSendSchema>;
