import { db } from '../db.js';
import { randomToken } from './crypto.js';

/** Creates a database-backed session and returns its opaque token. */
export async function createSession(
  userId: number,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<string> {
  const token = randomToken(32);
  await db.session.create({
    data: {
      id: token,
      userId,
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      payload: JSON.stringify({ userId }),
      lastActivity: Math.floor(Date.now() / 1000),
    },
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: token } });
}

/** Revokes every session of a user (used after a password change/reset). */
export async function destroyUserSessions(userId: number): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
