import type { Request, RequestHandler, Response } from 'express';
import { config } from '../config.js';
import { forbidden } from '../lib/http.js';
import { randomToken, safeEqual } from '../lib/crypto.js';

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * The session cookie is `SameSite=Lax`; this adds a second, unguessable token
 * that a cross-site form cannot read. Mutating requests must echo the token in
 * the `x-csrf-token` header. Requests authenticated by a bearer secret (the job
 * drain endpoint) and external webhooks are exempt because they do not rely on
 * the cookie.
 */
const CSRF_COOKIE = 'pe_csrf';
const CSRF_HEADER = 'x-csrf-token';

const EXEMPT_PATHS = [/^\/api\/v1\/jobs\/run\/?$/, /^\/api\/v1\/webhooks\//, /^\/api\/v1\/health/];

export function issueCsrf(res: Response): string {
  const token = randomToken(24);
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // must be readable by the client to be echoed back
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
  });
  return token;
}

export function csrfCookieName(): string {
  return CSRF_COOKIE;
}

export const csrfProtection: RequestHandler = (req: Request, _res, next) => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  if (EXEMPT_PATHS.some((re) => re.test(req.path))) return next();

  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);

  if (!cookie || !header || !safeEqual(String(cookie), String(header))) {
    return next(forbidden('نشانه امنیتی نامعتبر است. لطفاً صفحه را دوباره بارگذاری کنید.'));
  }
  next();
};
