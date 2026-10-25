/**
 * Import-safe entry point for other processes (the worker).
 *
 * Unlike `index.ts`, importing this module does not start a server — it only
 * registers job handlers and re-exports the queue runner, config and db.
 */
import './modules/handlers.js';

export { runDueJobs, requeueStalledJobs, enqueueJob, registerJobHandler } from './lib/jobs.js';
export { config } from './config.js';
export { db } from './db.js';
