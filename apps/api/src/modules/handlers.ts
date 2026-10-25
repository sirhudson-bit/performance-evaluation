import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registerJobHandler } from '../lib/jobs.js';
import { db } from '../db.js';
import { config } from '../config.js';
import { generateReport } from './reports/generate.js';
import { resolveEmployeeScope } from '../middleware/scope.js';
import type { AuthUser } from '../types.js';

/**
 * Job handlers. Importing this module registers them (side effect), which both
 * the API process and the standalone worker do.
 */

registerJobHandler('report.export', async (payload) => {
  const exportJobId = Number(payload.exportJobId);
  const job = await db.exportJob.findUniqueOrThrow({ where: { id: exportJobId } });

  await db.exportJob.update({ where: { id: exportJobId }, data: { status: 'processing' } });

  try {
    // Recompute the requesting user's scope so a background export can never
    // contain rows the user could not see at request time.
    let visibleEmployeeIds: number[] | 'all' = 'all';
    if (job.userId) {
      const user = await db.user.findUnique({
        where: { id: job.userId },
        include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
      });
      if (user) {
        const authLike = {
          id: user.id,
          organizationId: user.organizationId,
          isPlatformAdmin: user.isPlatformAdmin,
          permissions: user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.name)),
        } as AuthUser;
        const scope = await resolveEmployeeScope(authLike);
        visibleEmployeeIds = scope.seesAll ? 'all' : scope.employeeIds;
      }
    }

    const filters = (job.filters ?? {}) as {
      cycleId?: number;
      employeeId?: number;
      unitId?: number;
      managerId?: number;
      status?: string;
      scoreMin?: number;
      scoreMax?: number;
      columns?: string[];
    };

    const { buffer, rows } = await generateReport({
      organizationId: job.organizationId,
      report: job.report,
      format: job.format === 'csv' ? 'csv' : 'xlsx',
      filters,
      visibleEmployeeIds,
      columns: filters.columns,
    });

    const dir = join(config.storageDir, 'exports', String(job.organizationId));
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${job.id}.${job.format}`);
    await writeFile(filePath, buffer);

    await db.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'completed',
        filePath,
        rows,
        size: buffer.length,
        error: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  } catch (error) {
    await db.exportJob.update({
      where: { id: exportJobId },
      data: { status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'خطای نامشخص' },
    });
    throw error;
  }
});
