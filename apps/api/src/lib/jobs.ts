import { Prisma } from '@prisma/client';
import { db } from '../db.js';

/**
 * Durable, database-backed job queue.
 *
 * Redis/BullMQ is optional and not required: a `jobs` table with claim/lease
 * semantics gives the same durability for this workload (exports, imports,
 * reminders) without adding mandatory infrastructure. `apps/worker` drains it;
 * the API can also drain it on demand via POST /api/v1/jobs/run.
 *
 * Jobs are claimed with `SELECT ... FOR UPDATE SKIP LOCKED`, so multiple
 * workers never process the same row.
 */

export type JobPayload = Record<string, unknown>;

export interface JobContext {
  jobId: number;
  organizationId: number | null;
}

export type JobHandler = (payload: JobPayload, ctx: JobContext) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function registeredJobTypes(): string[] {
  return [...handlers.keys()];
}

/** Enqueues a job. A `dedupeKey` makes an enqueue idempotent (no duplicates). */
export async function enqueueJob(params: {
  organizationId?: number | null;
  type: string;
  payload?: JobPayload;
  queue?: string;
  dedupeKey?: string;
  runAt?: Date;
  maxAttempts?: number;
}): Promise<void> {
  const data = {
    organizationId: params.organizationId ?? null,
    type: params.type,
    payload: (params.payload ?? {}) as Prisma.InputJsonValue,
    queue: params.queue ?? 'default',
    dedupeKey: params.dedupeKey ?? null,
    runAt: params.runAt ?? new Date(),
    maxAttempts: params.maxAttempts ?? 3,
  };

  if (params.dedupeKey) {
    await db.job.upsert({
      where: { dedupeKey: params.dedupeKey },
      update: {}, // an existing, identical job is intentionally left as-is
      create: data,
    });
    return;
  }

  await db.job.create({ data });
}

/** Atomically claims up to `limit` due jobs for a worker. */
async function claimJobs(limit: number, workerId: string): Promise<number[]> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM jobs
      WHERE status = 'pending' AND run_at <= now()
      ORDER BY run_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];
    await tx.job.updateMany({
      where: { id: { in: ids } },
      data: { status: 'running', lockedAt: new Date(), lockedBy: workerId, attempts: { increment: 1 } },
    });
    return ids;
  });
}

function backoffMs(attempts: number): number {
  return Math.min(attempts * attempts * 1000, 60_000);
}

export interface DrainResult {
  processed: number;
  failed: number;
  claimed: number;
}

/** Drains due jobs once. Safe to call concurrently from multiple workers. */
export async function runDueJobs(workerId: string, limit = 10): Promise<DrainResult> {
  const ids = await claimJobs(limit, workerId);
  let processed = 0;
  let failed = 0;

  for (const id of ids) {
    const job = await db.job.findUnique({ where: { id } });
    if (!job) continue;

    const handler = handlers.get(job.type);
    try {
      if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
      await handler((job.payload ?? {}) as JobPayload, { jobId: job.id, organizationId: job.organizationId });
      await db.job.update({
        where: { id },
        data: { status: 'completed', lastError: null, lockedAt: null, lockedBy: null },
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      const dead = job.attempts >= job.maxAttempts;
      await db.job.update({
        where: { id },
        data: {
          status: dead ? 'dead' : 'pending',
          lastError: message.slice(0, 500),
          runAt: new Date(Date.now() + backoffMs(job.attempts)),
          lockedAt: null,
          lockedBy: null,
        },
      });
    }
  }

  return { processed, failed, claimed: ids.length };
}

/** Requeues jobs whose worker lease expired (a crashed worker). */
export async function requeueStalledJobs(olderThanMs = 10 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await db.job.updateMany({
    where: { status: 'running', lockedAt: { lt: cutoff } },
    data: { status: 'pending', lockedAt: null, lockedBy: null },
  });
  return result.count;
}
