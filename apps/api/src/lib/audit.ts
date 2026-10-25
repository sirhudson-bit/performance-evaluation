import type { Request } from 'express';
import { db } from '../db.js';

/**
 * Append-only audit trail for security-relevant changes.
 *
 * Passwords, secrets, tokens and full answer content are never recorded — the
 * `before`/`after` payloads are expected to be redacted by the caller.
 */
export interface AuditParams {
  organizationId: number | null;
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

const SENSITIVE_KEYS = /password|secret|token|api_?key|authorization|cookie/i;

/** Recursively removes credential-shaped keys from an audit payload. */
export function redact(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[redacted]' : redact(v);
  }
  return out;
}

export async function recordAudit(params: AuditParams, req?: Request): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId != null ? String(params.entityId) : null,
        before: params.before !== undefined ? (redact(params.before) as object) : undefined,
        after: params.after !== undefined ? (redact(params.after) as object) : undefined,
        metadata: params.metadata !== undefined ? (redact(params.metadata) as object) : undefined,
        ipAddress: req?.ip ?? null,
        userAgent: req?.get('user-agent') ?? null,
      },
    });
  } catch (error) {
    // Audit must never break the primary operation, but a silent failure would
    // hide a real problem — so surface it on the server console.
    console.error('[audit] failed to record entry:', error);
  }
}
