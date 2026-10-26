import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { exportRequestSchema, employeeImportConfirmSchema, EXPORT_REPORTS } from '@pe/validation';
import { Prisma } from '@prisma/client';
import { db } from '../../db.js';
import { asyncHandler, badRequest, forbidden, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization, resolveEmployeeScope, assertEmployeeAccess } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';
import { enqueueJob } from '../../lib/jobs.js';
import { exportLimiter, uploadLimiter } from '../../middleware/rateLimit.js';

export const reportsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|csv)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('فقط فایل xlsx یا csv مجاز است.'));
  },
});

// --- Exports ---------------------------------------------------------------
reportsRouter.post(
  '/exports',
  requirePermission('reports.export'),
  exportLimiter,
  validateBody(exportRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { report, format, filters, columns } = req.body as {
      report: string;
      format: 'xlsx' | 'csv';
      filters: Record<string, unknown>;
      columns?: string[];
    };

    // Raw per-respondent answers are the most sensitive export: restrict to a
    // platform administrator (or an explicit settings manager).
    if (report === 'responses_by_user' && !auth.isPlatformAdmin && !auth.permissions.includes('settings.manage')) {
      throw forbidden('خروجی پاسخ‌های کاربران تنها برای مدیر سامانه مجاز است.');
    }

    const job = await db.exportJob.create({
      data: {
        organizationId: orgId,
        userId: auth.id,
        report,
        format,
        filters: { ...filters, columns } as Prisma.InputJsonValue,
        status: 'pending',
      },
    });

    await enqueueJob({ organizationId: orgId, type: 'report.export', payload: { exportJobId: job.id }, maxAttempts: 3 });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'report.export_requested', entityType: 'export_job', entityId: job.id, after: { report, format } }, req);

    sendData(res, { id: job.id }, 202);
  }),
);

reportsRouter.get(
  '/exports',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const items = await db.exportJob.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 50 });
    sendData(res, { items, reports: EXPORT_REPORTS });
  }),
);

reportsRouter.get(
  '/exports/:id',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const job = await db.exportJob.findFirst({ where: { id: Number(req.params.id), organizationId: orgId } });
    if (!job) throw notFound();
    sendData(res, { job });
  }),
);

reportsRouter.get(
  '/exports/:id/download',
  requirePermission('reports.export'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const job = await db.exportJob.findFirst({ where: { id: Number(req.params.id), organizationId: orgId } });
    if (!job) throw notFound();
    // Ownership check in addition to organization + permission.
    if (job.userId !== auth.id && !auth.permissions.includes('settings.manage')) {
      throw forbidden('شما به این خروجی دسترسی ندارید.');
    }
    if (job.status !== 'completed' || !job.filePath) throw notFound('فایل خروجی آماده نیست.');
    if (job.expiresAt && job.expiresAt < new Date()) throw notFound('مهلت دانلود این فایل به پایان رسیده است.');

    const buffer = await readFile(job.filePath);
    const contentType =
      job.format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const filename = `${job.report}-${job.id}.${job.format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'report.export_downloaded', entityType: 'export_job', entityId: job.id }, req);
    res.send(buffer);
  }),
);

// --- Analytics (for charts) ------------------------------------------------
reportsRouter.get(
  '/analytics',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const cycleId = req.query.cycleId ? Number(req.query.cycleId) : undefined;
    const scope = await resolveEmployeeScope(auth);
    const scopeFilter = scope.seesAll ? {} : { employeeId: { in: scope.employeeIds } };

    const results = await db.finalEvaluationResult.findMany({
      where: { organizationId: orgId, ...(cycleId ? { cycleId } : {}), ...scopeFilter },
      select: {
        finalScore: true,
        status: true,
        employeeId: true,
        employee: { select: { unit: { select: { name: true } }, position: { select: { title: true } } } },
      },
    });
    const scored = results.filter((r) => r.finalScore !== null).map((r) => Number(r.finalScore));

    // Average score grouped by unit and by position (for the results charts).
    const groupAverage = (labelOf: (row: (typeof results)[number]) => string | null) => {
      const acc = new Map<string, { sum: number; count: number }>();
      for (const row of results) {
        if (row.finalScore === null) continue;
        const label = labelOf(row) ?? 'بدون تعیین';
        const entry = acc.get(label) ?? { sum: 0, count: 0 };
        entry.sum += Number(row.finalScore);
        entry.count += 1;
        acc.set(label, entry);
      }
      return [...acc.entries()]
        .map(([name, v]) => ({ name, average: Math.round((v.sum / v.count) * 100) / 100, count: v.count }))
        .sort((a, b) => b.average - a.average);
    };
    const byUnit = groupAverage((row) => row.employee.unit?.name ?? null);
    const byPosition = groupAverage((row) => row.employee.position?.title ?? null);

    const buckets = [0, 0, 0, 0, 0];
    for (const s of scored) {
      const idx = Math.min(4, Math.max(0, Math.floor(s / 20)));
      buckets[idx] = (buckets[idx] ?? 0) + 1;
    }

    const average = scored.length > 0 ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100 : null;

    const statusGroups = await db.evaluationAssignment.groupBy({
      by: ['status'],
      where: { organizationId: orgId, ...(cycleId ? { cycleId } : {}), ...scopeFilter },
      _count: { _all: true },
    });

    sendData(res, {
      cycleId: cycleId ?? null,
      total: results.length,
      scored: scored.length,
      average,
      distribution: [
        { range: '۰–۲۰', count: buckets[0] },
        { range: '۲۰–۴۰', count: buckets[1] },
        { range: '۴۰–۶۰', count: buckets[2] },
        { range: '۶۰–۸۰', count: buckets[3] },
        { range: '۸۰–۱۰۰', count: buckets[4] },
      ],
      statuses: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      byUnit,
      byPosition,
    });
  }),
);

// --- Per-person performance report ----------------------------------------
/**
 * Employee directory for the per-person report.
 *
 * Scope is enforced exactly like every other employee read: a manager sees
 * themselves and their current/historical reports; `employees.view_all` (HR,
 * platform admin) sees the organisation. Each row carries the latest result so
 * the list is useful without opening every person.
 */
reportsRouter.get(
  '/employees',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const scope = await resolveEmployeeScope(auth);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const items = await db.employee.findMany({
      where: {
        organizationId: orgId,
        status: { not: 'archived' },
        ...(scope.seesAll ? {} : { id: { in: scope.employeeIds } }),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { employeeNo: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        status: true,
        unit: { select: { name: true } },
        position: { select: { title: true } },
        results: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            finalScore: true,
            status: true,
            publishedAt: true,
            cycle: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 200,
    });

    sendData(res, {
      items: items.map((row) => ({
        id: row.id,
        employeeNo: row.employeeNo,
        name: `${row.firstName} ${row.lastName}`.trim(),
        status: row.status,
        unit: row.unit?.name ?? null,
        position: row.position?.title ?? null,
        latest: row.results[0]
          ? {
              score: row.results[0].finalScore !== null ? Number(row.results[0].finalScore) : null,
              status: row.results[0].status,
              publishedAt: row.results[0].publishedAt,
              cycle: row.results[0].cycle,
            }
          : null,
      })),
    });
  }),
);

/**
 * One employee's full performance record: every cycle result with its
 * evaluator/section breakdown, the assignment states, active agreements with
 * indicator progress, improvement plans and appeals.
 *
 * A foreign or out-of-scope id resolves to 404, never 403.
 */
reportsRouter.get(
  '/employees/:id',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const employeeId = Number(req.params.id);
    if (!Number.isFinite(employeeId)) throw notFound();
    await assertEmployeeAccess(auth, employeeId);

    const employee = await db.employee.findFirst({
      where: { id: employeeId, organizationId: orgId },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        hireDate: true,
        status: true,
        unit: { select: { name: true } },
        position: { select: { title: true } },
        manager: { select: { firstName: true, lastName: true } },
        user: { select: { id: true, email: true, lastLoginAt: true } },
        results: {
          orderBy: [{ cycle: { endDate: 'desc' } }],
          select: {
            id: true,
            finalScore: true,
            status: true,
            publishedAt: true,
            breakdown: true,
            cycle: { select: { id: true, name: true, startDate: true, endDate: true, status: true } },
          },
        },
        agreements: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            indicators: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, name: true, targetValue: true, actualValue: true, weight: true, progress: true },
            },
          },
        },
        improvementPlans: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, status: true, dueDate: true, actions: true },
        },
      },
    });
    if (!employee) throw notFound();

    const assignments = await db.evaluationAssignment.findMany({
      where: { organizationId: orgId, employeeId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        evaluatorRole: true,
        status: true,
        weight: true,
        submittedAt: true,
        dueDate: true,
        cycle: { select: { id: true, name: true } },
        scores: { select: { formScore: true, sectionScore: true } },
      },
    });

    const appeals = await db.appealRequest.findMany({
      where: { organizationId: orgId, employeeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, cycleId: true, reason: true, status: true, scoreBefore: true, scoreAfter: true, createdAt: true },
    });

    const scored = employee.results.filter((r) => r.finalScore !== null).map((r) => Number(r.finalScore));
    const average = scored.length > 0 ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100 : null;

    sendData(res, {
      employee: {
        id: employee.id,
        employeeNo: employee.employeeNo,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        email: employee.email,
        phone: employee.phone,
        hireDate: employee.hireDate,
        status: employee.status,
        unit: employee.unit?.name ?? null,
        position: employee.position?.title ?? null,
        manager: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim() : null,
        account: employee.user ? { id: employee.user.id, email: employee.user.email, lastLoginAt: employee.user.lastLoginAt } : null,
      },
      summary: {
        cycles: employee.results.length,
        scored: scored.length,
        average,
        latest: employee.results[0]
          ? {
              score: employee.results[0].finalScore !== null ? Number(employee.results[0].finalScore) : null,
              status: employee.results[0].status,
              publishedAt: employee.results[0].publishedAt,
              cycle: employee.results[0].cycle,
              breakdown: employee.results[0].breakdown,
            }
          : null,
        activePlans: employee.improvementPlans.filter((p) => p.status !== 'completed' && p.status !== 'cancelled').length,
        activeAgreements: employee.agreements.filter((a) => a.status === 'active').length,
        assignments: {
          total: assignments.length,
          completed: assignments.filter((a) => ['submitted', 'under_review', 'approved', 'published'].includes(a.status)).length,
        },
      },
      results: employee.results.map((r) => ({
        id: r.id,
        score: r.finalScore !== null ? Number(r.finalScore) : null,
        status: r.status,
        publishedAt: r.publishedAt,
        breakdown: r.breakdown,
        cycle: r.cycle,
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        evaluatorRole: a.evaluatorRole,
        status: a.status,
        weight: Number(a.weight),
        submittedAt: a.submittedAt,
        dueDate: a.dueDate,
        cycle: a.cycle,
        score: a.scores[0]?.formScore !== undefined && a.scores[0]?.formScore !== null ? Number(a.scores[0].formScore) : null,
      })),
      agreements: employee.agreements.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        startDate: a.startDate,
        endDate: a.endDate,
        indicators: a.indicators.map((i) => ({
          id: i.id,
          name: i.name,
          target: i.targetValue !== null ? Number(i.targetValue) : null,
          actual: i.actualValue !== null ? Number(i.actualValue) : null,
          weight: Number(i.weight),
          progress: i.progress,
        })),
      })),
      improvementPlans: employee.improvementPlans,
      appeals: appeals.map((a) => ({
        id: a.id,
        cycleId: a.cycleId,
        reason: a.reason,
        status: a.status,
        scoreBefore: a.scoreBefore !== null ? Number(a.scoreBefore) : null,
        scoreAfter: a.scoreAfter !== null ? Number(a.scoreAfter) : null,
        createdAt: a.createdAt,
      })),
    });
  }),
);

// --- Import: template + preview + confirm ----------------------------------
reportsRouter.get(
  '/imports/template',
  requirePermission('imports.manage'),
  asyncHandler(async (_req, res) => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('کارکنان');
    sheet.views = [{ rightToLeft: true }];
    sheet.addRow(['شماره پرسنلی', 'نام', 'نام خانوادگی', 'ایمیل', 'کد واحد', 'کد سمت', 'شماره پرسنلی مدیر']).font = { bold: true };
    sheet.addRow(['EMP-100', 'نام نمونه', 'نام خانوادگی نمونه', 'user@example.com', 'DEV', 'DEV', 'EMP-003']);
    sheet.columns.forEach((c) => (c.width = 24));

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="employees-template.xlsx"');
    res.send(buffer);
  }),
);

reportsRouter.post(
  '/imports/preview',
  requirePermission('imports.manage'),
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    if (!req.file) throw badRequest('فایلی بارگذاری نشده است.');

    const wb = new ExcelJS.Workbook();
    try {
      // ExcelJS's Buffer type differs from Node's generic Buffer; the runtime
      // value is a Node Buffer either way.
      await wb.xlsx.load(req.file.buffer as any);
    } catch {
      throw badRequest('فایل قابل خواندن نیست؛ فقط xlsx معتبر پذیرفته می‌شود.');
    }
    const sheet = wb.worksheets[0];
    if (!sheet) throw badRequest('شیت داده یافت نشد.');

    const existingEmployees = await db.employee.findMany({ where: { organizationId: orgId }, select: { employeeNo: true, email: true } });
    const existingNos = new Set(existingEmployees.map((e) => e.employeeNo));
    const existingEmails = new Set(existingEmployees.map((e) => (e.email ?? '').toLowerCase()).filter(Boolean));

    const valid: Record<string, unknown>[] = [];
    const invalid: { row: number; errors: string[] }[] = [];
    const seenNos = new Set<string>();
    const seenEmails = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const get = (col: number) => String(row.getCell(col).value ?? '').trim();
      const [employeeNo, firstName, lastName, email, unitCode, positionCode, managerNo] = [get(1), get(2), get(3), get(4), get(5), get(6), get(7)];
      if (!employeeNo && !firstName && !lastName) return; // skip blank row

      const errors: string[] = [];
      if (!employeeNo) errors.push('شماره پرسنلی الزامی است.');
      if (!firstName) errors.push('نام الزامی است.');
      if (!lastName) errors.push('نام خانوادگی الزامی است.');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('ایمیل معتبر نیست.');
      if (employeeNo && (existingNos.has(employeeNo) || seenNos.has(employeeNo))) errors.push('شماره پرسنلی تکراری است.');
      if (email && (existingEmails.has(email.toLowerCase()) || seenEmails.has(email.toLowerCase()))) errors.push('ایمیل تکراری است.');

      if (errors.length > 0) {
        invalid.push({ row: rowNumber, errors });
      } else {
        if (employeeNo) seenNos.add(employeeNo);
        if (email) seenEmails.add(email.toLowerCase());
        valid.push({ employeeNo, firstName, lastName, email: email || undefined, unitCode, positionCode, managerEmployeeNo: managerNo || undefined });
      }
    });

    sendData(res, { validCount: valid.length, invalidCount: invalid.length, valid, invalid, columns: ['شماره پرسنلی', 'نام', 'نام خانوادگی', 'ایمیل', 'کد واحد', 'کد سمت', 'شماره پرسنلی مدیر'] });
  }),
);

reportsRouter.post(
  '/imports/confirm',
  requirePermission('imports.manage'),
  validateBody(employeeImportConfirmSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { rows } = req.body as {
      rows: { employeeNo: string; firstName: string; lastName: string; email?: string; unitCode?: string; positionCode?: string; managerEmployeeNo?: string }[];
    };

    const job = await db.importJob.create({ data: { organizationId: orgId, userId: auth.id, type: 'employees', status: 'processing', summary: {} } });

    let created = 0;
    const errors: { row: number; message: string }[] = [];

    await db.$transaction(async (tx) => {
      for (const [index, row] of rows.entries()) {
        const dup = await tx.employee.findFirst({ where: { organizationId: orgId, employeeNo: row.employeeNo } });
        if (dup) {
          errors.push({ row: index + 2, message: `شماره پرسنلی ${row.employeeNo} تکراری است.` });
          continue;
        }
        const unit = row.unitCode ? await tx.organizationUnit.findFirst({ where: { organizationId: orgId, code: row.unitCode } }) : null;
        const position = row.positionCode ? await tx.position.findFirst({ where: { organizationId: orgId, code: row.positionCode } }) : null;
        const manager = row.managerEmployeeNo ? await tx.employee.findFirst({ where: { organizationId: orgId, employeeNo: row.managerEmployeeNo } }) : null;

        await tx.employee.create({
          data: {
            organizationId: orgId,
            employeeNo: row.employeeNo,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email ?? null,
            unitId: unit?.id ?? null,
            positionId: position?.id ?? null,
            managerId: manager?.id ?? null,
            status: 'active',
          },
        });
        created += 1;
      }
    });

    await db.importJob.update({
      where: { id: job.id },
      data: { status: errors.length > 0 ? 'completed_with_errors' : 'completed', summary: { created, failed: errors.length }, errors: errors as unknown as Prisma.InputJsonValue },
    });

    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'employees.imported', entityType: 'import_job', entityId: job.id, after: { created, failed: errors.length } }, req);
    sendData(res, { importJobId: job.id, created, failed: errors.length, errors });
  }),
);
