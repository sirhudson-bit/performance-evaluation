import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

/** Standard API error. Messages are safe Persian strings; internals never leak. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'درخواست نامعتبر است.', details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'برای این کار باید وارد شوید.') =>
  new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'شما به این بخش دسترسی ندارید.') =>
  new ApiError(403, 'forbidden', message);
export const notFound = (message = 'موردی یافت نشد.') => new ApiError(404, 'not_found', message);
export const conflict = (message = 'این عملیات با وضعیت فعلی سازگار نیست.', details?: unknown) =>
  new ApiError(409, 'conflict', message, details);
export const unprocessable = (message = 'داده‌ها معتبر نیست.', details?: unknown) =>
  new ApiError(422, 'unprocessable', message, details);
export const tooManyRequests = (message = 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید.') =>
  new ApiError(429, 'rate_limited', message);
export const serviceUnavailable = (message = 'سرویس در دسترس نیست.', details?: unknown) =>
  new ApiError(503, 'unavailable', message, details);

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function sendData(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}

/** Terminal error middleware — the single place responses leave as errors. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(422).json({ error: { code: 'validation_error', message: 'داده‌های ورودی معتبر نیست.', details } });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
    return;
  }

  // Multer / body-parser size limit.
  const anyErr = err as { type?: string; message?: string };
  if (anyErr?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'حجم درخواست بیش از حد مجاز است.' } });
    return;
  }

  // Unknown failure: log server-side, return a generic message (no internals).
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: { code: 'internal_error', message: 'خطای داخلی سرور رخ داد.' } });
}
