/**
 * Background worker.
 *
 * Drains the database-backed job queue (exports, imports, reminders) on a fixed
 * interval and reclaims jobs whose lease expired. It shares the API's job
 * handlers and configuration, so it never diverges from the API.
 */
import { runDueJobs, requeueStalledJobs, config } from '@pe/api/worker';
import pino from 'pino';

const logger = pino({ name: 'worker' });
const workerId = `worker-${process.pid}`;
const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 5000);

let running = false;

async function tick(): Promise<void> {
  if (running) return; // never overlap ticks
  running = true;
  try {
    const requeued = await requeueStalledJobs();
    const result = await runDueJobs(workerId, 25);
    if (result.claimed > 0 || requeued > 0) {
      logger.info({ ...result, requeued }, 'drained jobs');
    }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : error }, 'worker tick failed');
  } finally {
    running = false;
  }
}

logger.info(`[worker] started (env=${config.NODE_ENV}, interval=${INTERVAL_MS}ms)`);
void tick();
const timer = setInterval(() => void tick(), INTERVAL_MS);

process.on('SIGINT', () => {
  clearInterval(timer);
  process.exit(0);
});
process.on('SIGTERM', () => {
  clearInterval(timer);
  process.exit(0);
});
