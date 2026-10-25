import { PrismaClient } from '@prisma/client';

/**
 * Prisma client.
 *
 * Scoping is deliberately NOT a global query hook: an ambient scope would have
 * to read request state and would give the appearance of protection without
 * guaranteeing it. Instead every protected route resolves an explicit
 * `AuthContext` (organization id + visible employee ids) and every query filters
 * by it — see middleware/scope.ts.
 *
 * `rawDb` is the same client, named separately where a query intentionally runs
 * outside an organization (login, jobs, seeding).
 */
function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { peDb?: PrismaClient };

export const db: PrismaClient = globalForPrisma.peDb ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.peDb = db;
}

export const rawDb = db;
