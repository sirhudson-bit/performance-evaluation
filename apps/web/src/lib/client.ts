/**
 * Browser API client.
 *
 * Requests go to the Next origin (`/api/v1/...`) which proxies to the Express
 * API, so the session cookie is same-site. Mutating requests echo a CSRF token
 * read from the `pe_csrf` cookie (issued by the API).
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'ApiClientError';
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match && match[1] !== undefined ? decodeURIComponent(match[1]) : null;
}

/** Ensures a CSRF cookie exists (issued by the API on demand). */
export async function ensureCsrf(): Promise<void> {
  if (readCookie('pe_csrf')) return;
  try {
    await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  } catch {
    /* ignore — the next mutation will surface a clear error */
  }
}

export async function apiClient<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  if (method !== 'GET') await ensureCsrf();

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const csrf = readCookie('pe_csrf');
  if (csrf) headers['x-csrf-token'] = csrf;

  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { message?: string; details?: unknown } };
  if (!res.ok) {
    throw new ApiClientError(res.status, json?.error?.message ?? 'خطای غیرمنتظره رخ داد.', json?.error?.details);
  }
  return (json?.data ?? (json as unknown)) as T;
}
