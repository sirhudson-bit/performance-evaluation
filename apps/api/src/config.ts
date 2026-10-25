/**
 * Runtime configuration.
 *
 * Loads `.env` from the monorepo root (falling back to cwd), then validates the
 * environment with Zod so a missing secret fails fast at boot rather than
 * midway through a request.
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));

for (const candidate of [
  resolve(here, '../../../.env'), // apps/api/src -> repo root
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
]) {
  if (existsSync(candidate)) {
    // `.env` is authoritative for the local dev process (this machine exports
    // NODE_ENV=production globally, which would otherwise force prod cookies).
    // A production deployment ships no `.env` and uses real env vars instead.
    loadEnv({ path: candidate, override: true });
    break;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  APP_KEY: z.string().min(16, 'APP_KEY must be at least 16 characters.'),
  CRON_SECRET: z.string().min(8).optional(),
  APP_URL: z.string().default('http://localhost:3000'),
  APP_NAME: z.string().default('سامانه ارزیابی عملکرد'),
  API_PORT: z.coerce.number().int().default(4000),
  API_URL: z.string().default('http://127.0.0.1:4000'),
  SESSION_COOKIE_NAME: z.string().default('pe_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().default(43200),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  STORAGE_DIR: z.string().optional(),
  SEED_DEMO_DATA: z.string().optional(),
});

const parsed = schema.parse(process.env);

export const config = {
  ...parsed,
  isProd: parsed.NODE_ENV === 'production',
  isTest: parsed.NODE_ENV === 'test',
  storageDir: parsed.STORAGE_DIR || resolve(here, '../../../storage'),
  smtp: {
    host: parsed.SMTP_HOST || null,
    port: parsed.SMTP_PORT ? Number(parsed.SMTP_PORT) : null,
    secure: parsed.SMTP_SECURE === 'true',
    user: parsed.SMTP_USER || null,
    password: parsed.SMTP_PASSWORD || null,
    from: parsed.SMTP_FROM || null,
    configured: Boolean(parsed.SMTP_HOST && parsed.SMTP_FROM),
  },
};

export type AppConfig = typeof config;
