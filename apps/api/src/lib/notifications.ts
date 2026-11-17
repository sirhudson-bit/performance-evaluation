import { db } from '../db.js';

/**
 * Creates an in-app notification for one user. Notification failure must never
 * break the business action that triggered it, so callers treat this as a
 * best-effort side effect and the helper swallows logging-only errors.
 */
export async function notifyUser(input: {
  organizationId: number;
  userId: number | null | undefined;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (!input.userId) return;
  try {
    await db.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: (input.data ?? {}) as never,
      },
    });
  } catch {
    // A notification is not worth failing an assignment or publication for.
  }
}
