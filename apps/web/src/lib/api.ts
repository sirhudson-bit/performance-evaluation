import { cache } from 'react';
import { cookies } from 'next/headers';

/**
 * Server-side API client for React Server Components.
 *
 * The browser talks to the Next origin; server components forward the incoming
 * cookies to the standalone Express API. No API base URL or secret is exposed to
 * the browser this way.
 */
const API_URL = process.env.API_URL || 'http://127.0.0.1:4000';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      cookie: cookieHeader,
    },
    cache: 'no-store',
  });
}

/**
 * Fetches and unwraps `{ data }`; returns null on any non-ok response.
 *
 * Wrapped in React's `cache()`: several components in the same render pass
 * (layout + page, siblings) frequently request the same path. The cache is
 * per-request, so authenticated data is never shared across users.
 */
export const apiData = cache(async function apiData<T>(path: string): Promise<T | null> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    const json = (await res.json()) as { data: T };
    return json.data;
  } catch {
    return null;
  }
});

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  themePreference?: string;
  roles: { key: string; name: string }[];
  permissions: string[];
  department: { id: number; name: string } | null;
  employee: { id: number; employeeNo: string; firstName: string; lastName: string } | null;
  organization: { id: number; name: string; timezone: string; calendar: string } | null;
}

/** The current user, deduped per request (the shell and every page ask for it). */
export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
  return apiData<SessionUser>('/auth/me');
});

export function hasPermission(user: SessionUser | null, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}
