import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { questionImportConfirmSchema } from '@pe/validation';
import { ANSWER_TYPES, EVALUATOR_ROLES } from '@pe/shared';
import { db } from '../../db.js';
import { asyncHandler, badRequest, conflict, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { createQuestionWithOptions, type QuestionOptionDraft } from './service.js';
import { Prisma } from '@prisma/client';
import { cellText, normalizeDigits, normalizeStableKey, parseOptionList } from '../../lib/spreadsheet.js';

/**
 * Bulk question-bank import.
 *
 * The template mirrors the «پرسش جدید» form (category, stable key, title, text,
 * answer type, weight, required, options, respondents, status) and carries the
 * organization's real categories plus dropdown-validated answer types. A row's
 * options are written as `برچسب=امتیاز` separated by `|`, so a full bank can be
 * prepared in one Excel sheet without any JSON.
 */
export const questionsImportRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('فقط فایل xlsx مجاز است.'));
  },
});

const HEADERS = [
  'دسته',
  'شناسه پایدار *',
  'عنوان *',
  'متن پرسش *',
  'راهنما',
  'نوع پاسخ *',
  'وزن',
  'اجباری (بله/خیر)',
  'گزینه‌ها (برچسب=امتیاز | …)',
  'بازه امتیاز (مثلاً 1-10)',
  'پاسخ‌دهندگان',
  'موضوع ارزیابی',
  'وضعیت',
];

const SUBJECT_LABELS: Record<string, string> = {
  self: 'self', manager: 'manager', employee: 'employee', peer: 'peer', report: 'report', other: 'other',
};
const SUBJECT_FA: Record<string, string> = {
  'خود': 'self', 'مدیر': 'manager', 'کارمند': 'employee', 'همکار': 'peer', 'زیرمجموعه': 'report', 'سایر': 'other',
};
const STATUS_MAP: Record<string, string> = {
  'پیش‌نویس': 'draft', draft: 'draft',
  'فعال': 'active', active: 'active',
  'غیرفعال': 'inactive', inactive: 'inactive',
  'بایگانی': 'archived', 'بایگانی‌شده': 'archived', archived: 'archived',
};
const BOOL_TRUE = new Set(['بله', 'بلی', 'درست', 'yes', 'true', '1', '✓']);
const BOOL_FALSE = new Set(['خیر', 'نه', 'نادرست', 'no', 'false', '0']);

/** Standard option sets so a rating question never lands in the bank optionless. */
function defaultOptions(answerType: string): QuestionOptionDraft[] {
  if (answerType === 'rating_5') {
    return [
      { label: 'بسیار ضعیف', value: '1', score: 20 },
      { label: 'ضعیف', value: '2', score: 40 },
      { label: 'متوسط', value: '3', score: 60 },
      { label: 'خوب', value: '4', score: 80 },
      { label: 'عالی', value: '5', score: 100 },
    ].map((o, i) => ({ ...o, isNotApplicable: false, sortOrder: i }));
  }
  if (answerType === 'yes_no') {
    return [
      { label: 'بله', value: 'yes', score: 100 },
      { label: 'خیر', value: 'no', score: 0 },
    ].map((o, i) => ({ ...o, isNotApplicable: false, sortOrder: i }));
  }
  return [];
}

interface ParsedRow {
  rowNumber: number;
  categoryName?: string;
  stableKey: string;
  title: string;
  text: string;
  guidance?: string;
  answerType: string;
  weight: number;
  required: boolean;
  options: QuestionOptionDraft[];
  scoring: Record<string, unknown>;
  respondentRoles: string[];
  subjectType: string;
  status: string;
  sortOrder: number;
}

questionsImportRouter.get(
  '/import/template',
  requirePermission('questions.create'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const categories = await db.questionCategory.findMany({ where: { organizationId: orgId }, select: { name: true }, orderBy: { sortOrder: 'asc' } });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'سامانه ارزیابی عملکرد';
    const sheet = wb.addWorksheet('پرسش‌ها');
    sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
    sheet.addRow(HEADERS);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getRow(1).height = 36;
    [24, 20, 26, 46, 30, 18, 10, 16, 40, 18, 22, 18, 14].forEach((w, i) => (sheet.getColumn(i + 1).width = w));

    // Hidden reference columns on the same sheet (Excel rejects a cross-sheet
    // validation range without a named range).
    const lists: [number, string[]][] = [
      [15, Object.keys(ANSWER_TYPES)],
      [16, Object.keys(EVALUATOR_ROLES)],
      [17, ['self', 'manager', 'employee', 'peer', 'report', 'other']],
      [18, ['draft', 'active', 'inactive', 'archived']],
    ];
    for (const [col, items] of lists) {
      items.forEach((v, i) => (sheet.getCell(i + 2, col).value = v));
      sheet.getColumn(col).hidden = true;
    }
    const dl = (range: string, col: number, count: number) => {
      // ExcelJS ships `dataValidations` at runtime but its v4 typings omit it.
      const holder = sheet as unknown as { dataValidations: { add: (r: string, rule: Record<string, unknown>) => void } };
      holder.dataValidations.add(range, {
        type: 'list', allowBlank: true, showErrorMessage: false,
        formulae: [`$${String.fromCharCode(64 + col)}$2:$${String.fromCharCode(64 + col)}$${count + 1}`],
      });
    };
    dl('F2:F1000', 15, Object.keys(ANSWER_TYPES).length);
    dl('K2:K1000', 16, Object.keys(EVALUATOR_ROLES).length);
    dl('L2:L1000', 17, 6);
    dl('M2:M1000', 18, 4);
    sheet.autoFilter = { from: 'A1', to: 'M1' };

    const help = wb.addWorksheet('راهنما');
    help.views = [{ rightToLeft: true }];
    help.getColumn(1).width = 4;
    help.getColumn(2).width = 34;
    help.getColumn(3).width = 74;
    const title = help.addRow(['', 'راهنمای افزودن گروهی پرسش‌ها', '']);
    title.font = { bold: true, size: 14 };
    const lines: [string, string, string][] = [
      ['۱', 'ستون‌های اجباری', 'شناسه پایدار، عنوان، متن پرسش و نوع پاسخ.'],
      ['۲', 'شناسه پایدار', 'شناسه یکتای پرسش در همه نسخه‌ها؛ حروف کوچک لاتین، رقم و زیرخط. اگر فارسی بنویسید، خودکار به شکل مجاز تبدیل می‌شود و در پیش‌نمایش نشان داده می‌شود.'],
      ['۳', 'دسته', 'نام دسته؛ اگر وجود نداشته باشد ساخته می‌شود. خالی بماند، بدون دسته ثبت می‌شود.'],
      ['۴', 'گزینه‌ها', 'به شکل «برچسب=امتیاز» و جدا شده با |؛ مثال: بسیار ضعیف=20 | ضعیف=40 | خوب=80. برای طیف پنج‌گزینه‌ای و بله/خیر، خالی بماند تا گزینه‌های استاندارد ساخته شوند.'],
      ['۵', 'بازه امتیاز', 'فقط برای طیف عددی/درصد/عدد؛ مثال 1-10 یا 0-100.'],
      ['۶', 'پاسخ‌دهندگان', 'کلید نقش‌ها با کاما: self, manager, peer, report, hr, other. خالی بماند = manager.'],
      ['۷', 'موضوع ارزیابی', 'self / manager / employee / peer / report / other. خالی بماند = employee.'],
      ['۸', 'وضعیت', 'پیش‌نویس / فعال / غیرفعال / بایگانی. خالی بماند = فعال.'],
      ['۹', 'نمونه ردیف', 'پرسش‌های عمومی | quality_2 | کیفیت مستندسازی | کیفیت مستندسازی کار را چگونه ارزیابی می‌کنید؟ | (خالی) | rating_5 | 2 | بله | (خالی) | (خالی) | self, manager | employee | فعال'],
    ];
    lines.forEach(([n, k, v]) => {
      const row = help.addRow(['', `${n}. ${k}`, v]);
      row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    });

    help.addRow([]);
    const typeHead = help.addRow(['', 'نوع پاسخ (کلید — برچسب)', '']);
    typeHead.font = { bold: true };
    Object.entries(ANSWER_TYPES).forEach(([key, label]) => help.addRow(['', key, label]));

    help.addRow([]);
    const roleHead = help.addRow(['', 'پاسخ‌دهنده (کلید — برچسب)', '']);
    roleHead.font = { bold: true };
    Object.entries(EVALUATOR_ROLES).forEach(([key, label]) => help.addRow(['', key, label]));

    help.addRow([]);
    const catHead = help.addRow(['', 'دسته‌های فعلی بانک پرسش', '']);
    catHead.font = { bold: true };
    if (categories.length === 0) help.addRow(['', '—', 'هنوز دسته‌ای ثبت نشده است؛ نام دسته‌های جدید را در ستون «دسته» بنویسید.']);
    categories.forEach((c) => help.addRow(['', c.name, '']));

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''questions-template.xlsx");
    res.send(buffer);
  }),
);

questionsImportRouter.post(
  '/import/preview',
  requirePermission('questions.create'),
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    if (!req.file) throw badRequest('فایلی بارگذاری نشده است.');

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(req.file.buffer as unknown as ArrayBuffer);
    } catch {
      throw badRequest('فایل قابل خواندن نیست؛ فقط xlsx معتبر پذیرفته می‌شود.');
    }
    const sheet = wb.getWorksheet('پرسش‌ها') ?? wb.worksheets[0];
    if (!sheet) throw badRequest('برگه داده یافت نشد.');

    const [categories, existing] = await Promise.all([
      db.questionCategory.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
      db.question.findMany({ where: { organizationId: orgId }, select: { stableKey: true } }),
    ]);
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));
    const existingKeys = new Set(existing.map((q) => q.stableKey));
    const seenKeys = new Set<string>();

    const valid: ParsedRow[] = [];
    const invalid: { row: number; errors: string[]; raw: string[] }[] = [];
    const newCategories = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const categoryRaw = cellText(row, 1);
      const keyRaw = cellText(row, 2);
      const title = cellText(row, 3);
      const text = cellText(row, 4);
      const guidance = cellText(row, 5);
      const answerRaw = cellText(row, 6);
      const weightRaw = cellText(row, 7);
      const requiredRaw = cellText(row, 8);
      const optionsRaw = cellText(row, 9);
      const rangeRaw = cellText(row, 10);
      const respondentsRaw = cellText(row, 11);
      const subjectRaw = cellText(row, 12);
      const statusRaw = cellText(row, 13);
      if (!keyRaw && !title && !text) return; // blank row

      const errors: string[] = [];
      const raw = [categoryRaw, keyRaw, title, text, guidance, answerRaw, weightRaw, requiredRaw, optionsRaw, rangeRaw];
      const stableKey = normalizeStableKey(keyRaw);
      if (!stableKey) errors.push('شناسه پایدار الزامی است (حروف کوچک لاتین، رقم و زیرخط).');
      else if (stableKey.length < 2) errors.push('شناسه پایدار باید حداقل ۲ نویسه باشد.');
      else if (existingKeys.has(stableKey)) errors.push(`شناسه پایدار «${stableKey}» از قبل در بانک پرسش وجود دارد.`);
      else if (seenKeys.has(stableKey)) errors.push(`شناسه پایدار «${stableKey}» در فایل تکراری است.`);

      if (!title || title.length < 2) errors.push('عنوان پرسش الزامی است.');
      if (!text || text.length < 2) errors.push('متن پرسش الزامی است.');

      const answerType = answerRaw.trim();
      if (!answerType) errors.push('نوع پاسخ الزامی است.');
      else if (!(answerType in ANSWER_TYPES)) errors.push(`نوع پاسخ «${answerType}» معتبر نیست.`);

      const weight = weightRaw ? Number(normalizeDigits(weightRaw)) : 1;
      if (weightRaw && !Number.isFinite(weight)) errors.push('وزن باید عدد باشد.');

      let required = true;
      if (requiredRaw) {
        const v = requiredRaw.trim().toLowerCase();
        if (BOOL_TRUE.has(v)) required = true;
        else if (BOOL_FALSE.has(v)) required = false;
        else errors.push('ستون «اجباری» فقط بله یا خیر می‌پذیرد.');
      }

      const categoryName = categoryRaw.trim();
      if (categoryName && !categoryByName.has(categoryName.toLowerCase())) newCategories.add(categoryName);

      let scoring: Record<string, unknown> = {};
      if (rangeRaw) {
        const m = normalizeDigits(rangeRaw).match(/^\s*(-?\d+(?:\.\d+)?)\s*[-–—تا]+\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (!m) errors.push('بازه امتیاز را به شکل 1-10 بنویسید.');
        else {
          const min = Number(m[1]);
          const max = Number(m[2]);
          if (!(max > min)) errors.push('حداکثر بازه باید بزرگ‌تر از حداقل باشد.');
          else scoring = { min, max };
        }
      }

      const options = optionsRaw ? parseOptionList(optionsRaw) : defaultOptions(answerType);
      if (options.some((o) => o.label.length === 0)) errors.push('برچسب گزینه خالی است.');

      const respondentRoles = (respondentsRaw ? respondentsRaw.split(/[,،;|\s]+/) : ['manager'])
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      for (const role of respondentRoles) {
        if (!(role in EVALUATOR_ROLES)) errors.push(`پاسخ‌دهنده «${role}» معتبر نیست.`);
      }

      const subjectRawKey = (subjectRaw || 'employee').trim().toLowerCase();
      const subjectType = SUBJECT_LABELS[subjectRawKey] ?? SUBJECT_FA[subjectRawKey] ?? 'employee';
      if (subjectRaw && !SUBJECT_LABELS[subjectRawKey] && !SUBJECT_FA[subjectRawKey]) errors.push(`موضوع ارزیابی «${subjectRaw}» معتبر نیست.`);

      const status = statusRaw ? STATUS_MAP[statusRaw.trim().toLowerCase()] ?? STATUS_MAP[statusRaw.trim()] : 'active';
      if (!status) errors.push(`وضعیت «${statusRaw}» معتبر نیست.`);

      if (errors.length > 0) {
        invalid.push({ row: rowNumber, errors, raw });
        return;
      }
      seenKeys.add(stableKey);
      valid.push({
        rowNumber,
        categoryName: categoryName || undefined,
        stableKey,
        title,
        text,
        guidance: guidance || undefined,
        answerType,
        weight: Number.isFinite(weight) ? Math.max(0, weight) : 1,
        required,
        options,
        scoring,
        respondentRoles: respondentRoles.length > 0 ? respondentRoles : ['manager'],
        subjectType,
        status: status as string,
        sortOrder: 0,
      });
    });

    sendData(res, {
      validCount: valid.length,
      invalidCount: invalid.length,
      valid,
      invalid,
      columns: HEADERS,
      newCategories: Array.from(newCategories),
      limits: { maxRows: 500 },
    });
  }),
);

questionsImportRouter.post(
  '/import/confirm',
  requirePermission('questions.create'),
  validateBody(questionImportConfirmSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { rows, createMissingCategories } = req.body as { rows: ParsedRow[]; createMissingCategories: boolean };

    const job = await db.importJob.create({ data: { organizationId: orgId, userId: auth.id, type: 'questions', status: 'processing', summary: {} } });

    const categories = await db.questionCategory.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, sortOrder: true } });
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    let nextCategoryOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;
    const latest = await db.question.findFirst({ where: { organizationId: orgId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    let nextSortOrder = (latest?.sortOrder ?? 0) + 1;

    let categoriesCreated = 0;
    const errors: { row: number; message: string }[] = [];
    const created: { id: number; stableKey: string; title: string }[] = [];
    const seen = new Set<string>();

    for (const [index, row] of rows.entries()) {
      const label = row.rowNumber ?? index + 2;
      if (seen.has(row.stableKey)) {
        errors.push({ row: label, message: `شناسه پایدار «${row.stableKey}» در همین فایل تکراری است.` });
        continue;
      }
      const duplicate = await db.question.findFirst({ where: { organizationId: orgId, stableKey: row.stableKey }, select: { id: true } });
      if (duplicate) {
        errors.push({ row: label, message: `پرسشی با شناسه «${row.stableKey}» از قبل وجود دارد.` });
        continue;
      }

      let categoryId: number | null = null;
      if (row.categoryName) {
        const key = row.categoryName.trim().toLowerCase();
        const existingId = categoryByName.get(key);
        if (existingId) categoryId = existingId;
        else if (createMissingCategories) {
          const cat = await db.questionCategory.create({ data: { organizationId: orgId, name: row.categoryName.trim(), sortOrder: nextCategoryOrder++ } });
          categoryByName.set(key, cat.id);
          categoriesCreated += 1;
          categoryId = cat.id;
        } else {
          errors.push({ row: label, message: `دسته «${row.categoryName}» وجود ندارد و ساخت دسته جدید غیرفعال است.` });
          continue;
        }
      }

      const question = await createQuestionWithOptions(
        orgId,
        {
          stableKey: row.stableKey,
          categoryId,
          title: row.title,
          text: row.text,
          guidance: row.guidance ?? null,
          subjectType: row.subjectType,
          respondentRoles: row.respondentRoles,
          answerType: row.answerType,
          required: row.required,
          weight: row.weight,
          scoring: row.scoring ?? {},
          status: row.status,
          sortOrder: nextSortOrder++,
          options: row.options,
        },
        auth.id,
      );
      seen.add(row.stableKey);
      created.push({ id: question.id, stableKey: question.stableKey, title: question.title });
    }

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        summary: { created: created.length, failed: errors.length, categoriesCreated },
        errors: errors as unknown as Prisma.InputJsonValue,
      },
    });

    await recordAudit({
      organizationId: orgId,
      actorUserId: auth.id,
      action: 'questions.imported',
      entityType: 'import_job',
      entityId: job.id,
      after: { created: created.length, failed: errors.length, categoriesCreated },
    }, req);

    if (created.length === 0 && errors.length > 0) {
      throw conflict('هیچ پرسشی ثبت نشد؛ فهرست خطاها را ببینید.', errors);
    }

    sendData(res, {
      importJobId: job.id,
      created: created.length,
      failed: errors.length,
      categoriesCreated,
      errors,
      createdQuestions: created,
    });
  }),
);
