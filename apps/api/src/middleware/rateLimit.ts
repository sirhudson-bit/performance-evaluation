import rateLimit from 'express-rate-limit';

/**
 * Rate limits for resource-intensive and credential-sensitive endpoints.
 * Keys are per-IP; authenticated user limits are layered on top where useful.
 */
function makeLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message } },
  });
}

export const loginLimiter = makeLimiter(5 * 60 * 1000, 8, 'تلاش‌های ورود بیش از حد مجاز است. چند دقیقه بعد دوباره تلاش کنید.');
export const otpRequestLimiter = makeLimiter(10 * 60 * 1000, 5, 'تعداد درخواست‌های رمز یکبار مصرف بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.');
export const otpVerifyLimiter = makeLimiter(10 * 60 * 1000, 12, 'تعداد تلاش‌های رمز یکبار مصرف بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.');
export const resetLimiter = makeLimiter(15 * 60 * 1000, 5, 'تعداد درخواست‌های بازیابی رمز بیش از حد مجاز است.');
export const aiLimiter = makeLimiter(60 * 1000, 20, 'تعداد درخواست‌های هوش مصنوعی بیش از حد مجاز است.');
export const exportLimiter = makeLimiter(10 * 60 * 1000, 30, 'تعداد درخواست‌های خروجی بیش از حد مجاز است.');
export const uploadLimiter = makeLimiter(10 * 60 * 1000, 20, 'تعداد بارگذاری‌ها بیش از حد مجاز است.');
