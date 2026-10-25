import ExcelJS from 'exceljs';
import { db } from '../../db.js';
import { sanitizeCell, buildCsv } from '../../lib/excel.js';

/**
 * Generates a role-scoped report as .xlsx (multi-sheet) or .csv.
 *
 * `visibleEmployeeIds` is the caller's data scope: a manager only ever receives
 * rows for employees they may see, regardless of the requested filters. The
 * generation is deterministic and the raw components (score, weights, per
 * evaluator, per section) are preserved so every figure is explainable.
 */
export interface ReportParams {
  organizationId: number;
  report: string;
  format: 'xlsx' | 'csv';
  filters: {
    cycleId?: number;
    employeeId?: number;
    unitId?: number;
    managerId?: number;
    status?: string;
    scoreMin?: number;
    scoreMax?: number;
  };
  visibleEmployeeIds: number[] | 'all';
  columns?: string[];
}

export async function generateReport(params: ReportParams): Promise<{ buffer: Buffer; rows: number }> {
  const { organizationId, filters } = params;

  // The per-respondent answer export has its own shape (one row per answer).
  if (params.report === 'responses_by_user') {
    return generateResponsesByUser(params);
  }

  const scopeFilter = params.visibleEmployeeIds === 'all' ? {} : { employeeId: { in: params.visibleEmployeeIds } };

  const results = await db.finalEvaluationResult.findMany({
    where: {
      organizationId,
      ...(filters.cycleId ? { cycleId: filters.cycleId } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.scoreMin !== undefined ? { finalScore: { gte: filters.scoreMin } } : {}),
      ...(filters.scoreMax !== undefined ? { finalScore: { lte: filters.scoreMax } } : {}),
      ...scopeFilter,
    },
    include: {
      employee: { include: { unit: true, manager: true } },
      cycle: { include: { formVersion: { include: { form: true } } } },
    },
    orderBy: { finalScore: 'desc' },
  });

  const employeeIds = results.map((r) => r.employeeId);

  const assignments = await db.evaluationAssignment.findMany({
    where: { organizationId, ...(filters.cycleId ? { cycleId: filters.cycleId } : {}), employeeId: { in: employeeIds } },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } } },
  });

  const appeals = await db.appealRequest.findMany({
    where: { organizationId, ...(filters.cycleId ? { cycleId: filters.cycleId } : {}), employeeId: { in: employeeIds } },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } } },
  });

  const recommendations = await db.compensationRecommendation.findMany({
    where: { organizationId, employeeId: { in: employeeIds } },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } } },
  });

  const statusLabels: Record<string, string> = {
    draft: 'پیش‌نویس',
    assigned: 'ارجاع‌شده',
    in_progress: 'در حال تکمیل',
    submitted: 'ارسال‌شده',
    under_review: 'در حال بررسی',
    approved: 'تأییدشده',
    published: 'منتشرشده',
    returned_for_revision: 'بازگشت برای اصلاح',
  };

  if (params.format === 'csv') {
    const rows: unknown[][] = [['شماره پرسنلی', 'نام', 'واحد', 'دوره', 'امتیاز نهایی', 'وضعیت']];
    for (const r of results) {
      rows.push([
        r.employee.employeeNo,
        `${r.employee.firstName} ${r.employee.lastName}`,
        r.employee.unit?.name ?? '',
        r.cycle.name,
        r.finalScore !== null ? Number(r.finalScore) : '',
        r.status,
      ]);
    }
    return { buffer: Buffer.from(buildCsv(rows), 'utf8'), rows: results.length };
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'سامانه ارزیابی عملکرد';

  const addSheet = (name: string, headers: string[], data: unknown[][]) => {
    const sheet = wb.addWorksheet(name);
    sheet.views = [{ rightToLeft: true }];
    sheet.addRow(headers.map((h) => sanitizeCell(h)));
    sheet.getRow(1).font = { bold: true };
    for (const row of data) sheet.addRow(row.map((c) => sanitizeCell(c)));
    sheet.columns.forEach((col) => {
      col.width = 22;
    });
    return sheet;
  };

  // Executive summary
  const scored = results.filter((r) => r.finalScore !== null).map((r) => Number(r.finalScore));
  const average = scored.length > 0 ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100 : null;
  addSheet('خلاصه اجرایی', ['شاخص', 'مقدار'], [
    ['تعداد نتایج', results.length],
    ['میانگین امتیاز', average ?? '—'],
    ['بیشترین امتیاز', scored.length ? Math.max(...scored) : '—'],
    ['کمترین امتیاز', scored.length ? Math.min(...scored) : '—'],
    ['تعداد اعتراض‌ها', appeals.length],
  ]);

  // Employee results
  addSheet(
    'نتایج کارکنان',
    ['شماره پرسنلی', 'نام', 'واحد', 'مدیر', 'دوره', 'امتیاز نهایی', 'وضعیت'],
    results.map((r) => [
      r.employee.employeeNo,
      `${r.employee.firstName} ${r.employee.lastName}`,
      r.employee.unit?.name ?? '',
      r.employee.manager ? `${r.employee.manager.firstName} ${r.employee.manager.lastName}` : '',
      r.cycle.name,
      r.finalScore !== null ? Number(r.finalScore) : '',
      r.status,
    ]),
  );

  // Scores breakdown (per evaluator/section from the stored breakdown)
  const breakdownRows: unknown[][] = [];
  for (const r of results) {
    const breakdown = r.breakdown as { evaluators?: { evaluatorRole: string; weight: number; included: boolean; formScore: number | null }[] };
    for (const ev of breakdown.evaluators ?? []) {
      breakdownRows.push([
        r.employee.employeeNo,
        `${r.employee.firstName} ${r.employee.lastName}`,
        ev.evaluatorRole,
        ev.weight,
        ev.included ? 'بله' : 'خیر',
        ev.formScore ?? '—',
      ]);
    }
  }
  addSheet('تفکیک امتیاز', ['شماره پرسنلی', 'نام', 'نقش ارزیاب', 'وزن ارزیاب', 'شمارش‌شده', 'امتیاز فرم'], breakdownRows);

  // Completion status
  addSheet(
    'وضعیت تکمیل',
    ['شماره پرسنلی', 'نام', 'نقش ارزیاب', 'وضعیت'],
    assignments.map((a) => [a.employee.employeeNo, `${a.employee.firstName} ${a.employee.lastName}`, a.evaluatorRole, statusLabels[a.status] ?? a.status]),
  );

  // Appeals
  addSheet(
    'اعتراض‌ها',
    ['شماره پرسنلی', 'نام', 'وضعیت', 'امتیاز پیش از اعتراض'],
    appeals.map((a) => [a.employee.employeeNo, `${a.employee.firstName} ${a.employee.lastName}`, a.status, a.scoreBefore !== null ? Number(a.scoreBefore) : '—']),
  );

  // Compensation
  addSheet(
    'جبران خدمات',
    ['شماره پرسنلی', 'نام', 'نوع پیشنهاد', 'مقدار', 'وضعیت'],
    recommendations.map((c) => [c.employee.employeeNo, `${c.employee.firstName} ${c.employee.lastName}`, c.proposedType ?? '—', c.proposedValue !== null ? Number(c.proposedValue) : '—', c.status]),
  );

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), rows: results.length };
}

/**
 * Export of raw responses grouped by employee — one row per answer, with the
 * question, the answer, the normalized score, and N/A state. This is the most
 * sensitive report and the API restricts it to a platform administrator.
 */
async function generateResponsesByUser(params: ReportParams): Promise<{ buffer: Buffer; rows: number }> {
  const { organizationId } = params;

  let cycleId = params.filters.cycleId;
  if (!cycleId) {
    const latest = await db.evaluationCycle.findFirst({ where: { organizationId }, orderBy: { id: 'desc' }, select: { id: true } });
    cycleId = latest?.id;
  }
  if (!cycleId) return { buffer: Buffer.from(''), rows: 0 };

  const cycle = await db.evaluationCycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: { formVersion: { include: { questions: { include: { questionVersion: true } } } } },
  });

  const titleByQuestion = new Map<number, string>();
  for (const fq of cycle.formVersion.questions) {
    const snapshot = (fq.questionVersion.snapshot ?? {}) as { title?: string };
    titleByQuestion.set(fq.id, snapshot.title ?? '');
  }

  const assignments = await db.evaluationAssignment.findMany({
    where: {
      organizationId,
      cycleId,
      ...(params.visibleEmployeeIds === 'all' ? {} : { employeeId: { in: params.visibleEmployeeIds } }),
    },
    include: {
      employee: {
        select: { employeeNo: true, firstName: true, lastName: true, unit: { select: { name: true } }, position: { select: { title: true } } },
      },
      responses: { orderBy: { formQuestionId: 'asc' } },
    },
    orderBy: { employeeId: 'asc' },
  });

  const render = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map((v) => String(v)).join('، ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const header = ['شماره پرسنلی', 'نام کارمند', 'واحد', 'سمت', 'نقش ارزیاب', 'پرسش', 'پاسخ', 'امتیاز', 'مصداق ندارد'];
  const body: unknown[][] = [];
  for (const a of assignments) {
    for (const r of a.responses) {
      body.push([
        a.employee.employeeNo,
        `${a.employee.firstName} ${a.employee.lastName}`,
        a.employee.unit?.name ?? '',
        a.employee.position?.title ?? '',
        a.evaluatorRole,
        titleByQuestion.get(r.formQuestionId) ?? '',
        render(r.value),
        r.score !== null ? Number(r.score) : '',
        r.isNotApplicable ? 'بله' : 'خیر',
      ]);
    }
  }

  if (params.format === 'csv') {
    return { buffer: Buffer.from(buildCsv([header, ...body]), 'utf8'), rows: body.length };
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'سامانه ارزیابی عملکرد';
  const sheet = wb.addWorksheet('پاسخ‌های کاربران');
  sheet.views = [{ rightToLeft: true }];
  sheet.addRow(header.map((h) => sanitizeCell(h)));
  sheet.getRow(1).font = { bold: true };
  for (const row of body) sheet.addRow(row.map((c) => sanitizeCell(c)));
  sheet.columns.forEach((col) => {
    col.width = 22;
  });
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), rows: body.length };
}
