import type { Request, RequestHandler } from 'express';
import { PERMISSION_NAMES } from '@pe/shared';
import { db } from '../db.js';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../lib/http.js';
import type { AuthUser } from '../types.js';

export const SESSION_COOKIE = config.SESSION_COOKIE_NAME;

export interface LoadedSession {
  user: AuthUser;
  lastActivity: number;
}

/**
 * Resolves the signed-in user for a request.
 *
 * The session row is the authority: deleting it logs the user out immediately,
 * which is what makes "logout ends the session" true rather than cosmetic.
 * Sliding expiry keeps an active session alive without extending an idle one
 * beyond the TTL.
 */
export async function loadSession(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const session = await db.session.findUnique({ where: { id: token } });
  if (!session?.userId) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - session.lastActivity > config.SESSION_TTL_SECONDS) {
    await db.session.deleteMany({ where: { id: token } });
    return null;
  }

  if (nowSeconds - session.lastActivity > 60) {
    await db.session.update({ where: { id: token }, data: { lastActivity: nowSeconds } });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });

  if (!user || user.status !== 'active') return null;

  const roleKeys = user.roles.map((r) => r.role.key);
  const isSuper = user.isPlatformAdmin || roleKeys.includes('platform_super_admin');
  const permissions = Array.from(
    new Set([
      ...user.roles.flatMap((r) => r.role.permissions.map((rp) => rp.permission.name)),
      ...(isSuper ? PERMISSION_NAMES : []),
    ]),
  );

  return {
    id: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    isPlatformAdmin: isSuper,
    roleKeys,
    permissions,
    sessionId: session.id,
  };
}

/** Attaches req.auth when a valid session exists; never rejects. */
export const attachAuth: RequestHandler = (req, _res, next) => {
  loadSession(req)
    .then((user) => {
      if (user) req.auth = user;
      next();
    })
    .catch(next);
};

export function getAuth(req: Request): AuthUser {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

/** Requires an authenticated, active session. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  next();
};

function ensure(user: AuthUser, permission: string): void {
  if (!user.permissions.includes(permission)) throw forbidden();
}

/** Requires every listed permission. */
export function requirePermission(...permissions: string[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.auth;
    if (!user) return next(unauthorized());
    for (const p of permissions) ensure(user, p);
    next();
  };
}

/** Requires at least one of the listed permissions. */
export function requireAnyPermission(permissions: string[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.auth;
    if (!user) return next(unauthorized());
    if (!permissions.some((p) => user.permissions.includes(p))) return next(forbidden());
    next();
  };
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  return user.permissions.includes(permission);
}
