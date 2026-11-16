import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import { userImportConfirmSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, badRequest, conflict, forbidden, sendData } from '../../lib/http.js';
import { randomToken } from '../../lib/crypto.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth, hasPermission } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { Prisma } from '@prisma/client';
import { cellText, normalizeDigits } from '../../lib/spreadsheet.js';

/**
 * Bulk user import from a prepared Excel file.
 *
 * The template is generated per organization: it carries the real department
 * codes and role keys of this tenant, and the department/status columns have
 * dropdown validation — so "a template that matches the create-user form", not
 * a generic blank sheet. Nothing is written until the operator has seen the
 * preview (valid / invalid / duplicate rows) and confirmed.
 */
export const usersImportRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('فقط فایل xlsx مجاز است.'));
  },
});

const HEADERS = ['نام و نام خانوادگی *', 'ایمیل *', 'موبایل', 'دپارتمان (کد یا نام)', 'نقش‌ها (با کاما)', 'وضعیت', 'رمز عبور (اختیاری)'];
const STATUS_MAP: Record<string, string> = {
  'فعال': 'active',
  active: 'active',
  'غیرفعال': 'suspended',
  suspended: 'suspended',
  'بایگانی': 'archived',
  'بایگانی‌شده': 'archived',
  archived: 'archived',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0?9\d{9}$/;


async function loadLookups(orgId: number) {
  const [units, roles] = await Promise.all([
    db.organizationUnit.findMany({ where: { organizationId: orgId }, select: { id: true, code: true, name: true }, orderBy: { name: 'asc' } }),
    db.role.findMany({ where: { organizationId: orgId }, select: { id: true, key: true, name: true, isProtected: true }, orderBy: { id: 'asc' } }),
  ]);
  return { units, roles };
}

/**
 * A generated one-time password must satisfy the shared policy (≥8 characters,
 * a letter and a digit). `randomToken` is base64url, so a suffix guarantees both
 * classes instead of hoping the bytes happen to contain a digit.
 */
function generatePassword(): string {
  return `${randomToken(9).replace(/[^A-Za-z0-9]/g, '')}A1`;
}

/**
 * The generated workbook: a data sheet plus a help sheet that lists the real
 * departments and roles, so the operator never has to guess a code.
 */
usersImportRouter.get(
  '/import/template',
  requirePermission('users.create'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const { units, roles } = await loadLookups(orgId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'سامانه ارزیابی عملکرد';
    const sheet = wb.addWorksheet('کاربران');
    sheet.views = [{ rightToLeft: true }];
    sheet.addRow(HEADERS);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getRow(1).height = 32;
    const widths = [26, 28, 16, 24, 26, 14, 20];
    widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
    sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];

    // Reference lists live in hidden columns of the same sheet: Excel refuses a
    // cross-sheet data-validation range without a named range, a same-sheet
    // range always works.
    const DEPT_COL = 10;
    const ROLE_COL = 11;
    const deptItems = units.map((u) => (u.code ? `${u.code} — ${u.name}` : u.name));
    const roleItems = roles.filter((r) => !r.isProtected).map((r) => r.key);
    deptItems.forEach((v, i) => {
      const cell = sheet.getCell(i + 2, DEPT_COL);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
    roleItems.forEach((v, i) => {
      const cell = sheet.getCell(i + 2, ROLE_COL);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
    sheet.getColumn(DEPT_COL).hidden = true;
    sheet.getColumn(ROLE_COL).hidden = true;
    sheet.getCell(1, DEPT_COL).value = 'dept-list';
    sheet.getCell(1, ROLE_COL).value = 'role-list';

    if (deptItems.length > 0) {
      const holder = sheet as unknown as { dataValidations: { add: (r: string, rule: Record<string, unknown>) => void } };
      holder.dataValidations.add(`D2:D1000`, {
        type: 'list', allowBlank: true, showErrorMessage: false,
        formulae: [`$J$2:$J$${deptItems.length + 1}`],
      });
    }
    const ruleHolder = sheet as unknown as { dataValidations: { add: (r: string, rule: Record<string, unknown>) => void } };
    ruleHolder.dataValidations.add('F2:F1000', {
      type: 'list', allowBlank: true, showErrorMessage: false,
      formulae: ['"فعال,غیرفعال,بایگانی"'],
    });
    sheet.autoFilter = { from: 'A1', to: 'G1' };

    const help = wb.addWorksheet('راهنما');
    help.views = [{ rightToLeft: true }];
    help.getColumn(1).width = 4;
    help.getColumn(2).width = 34;
    help.getColumn(3).width = 70;
    const title = help.addRow(['', 'راهنمای افزودن گروهی کاربران', '']);
    title.font = { bold: true, size: 14 };
    const lines: [string, string, string][] = [
      ['۱', 'ستون‌های اجباری', 'نام و نام خانوادگی و ایمیل. بقیه ستون‌ها اختیاری‌اند.'],
      ['۲', 'دپارتمان', 'کد یا نام دقیق واحد سازمانی. فهرست معتبر در انتهای همین برگه آمده است.'],
      ['۳', 'نقش‌ها', 'کلید یا نام نقش، چند نقش را با کاما جدا کنید. خالی بماند، نقش «کارمند» داده می‌شود.'],
      ['۴', 'وضعیت', 'فعال / غیرفعال / بایگانی. خالی بماند، «فعال» در نظر گرفته می‌شود.'],
      ['۵', 'رمز عبور', 'اختیاری. تعیین رمز فقط برای مدیر ارشد سامانه مجاز است؛ در غیر این صورت رمز یک‌بارمصرف ساخته و پس از ثبت نمایش داده می‌شود.'],
      ['۶', 'نمونه ردیف', 'نمونه سامان احمدی | saman@example.com | 09121234567 | ' + (deptItems[0] ?? 'کد واحد') + ' | ' + (roleItems[0] ?? 'employee') + ' | فعال | (خالی)'],
    ];
    lines.forEach(([n, k, v]) => {
      const row = help.addRow(['', `${n}. ${k}`, v]);
      row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    });

    help.addRow([]);
    const deptHead = help.addRow(['', 'دپارتمان‌های سازمان (کد — نام)', '']);
    deptHead.font = { bold: true };
    if (units.length === 0) help.addRow(['', '—', 'هنوز واحد سازمانی ثبت نشده است؛ ابتدا «ساختار سازمانی» را کامل کنید.']);
    units.forEach((u) => help.addRow(['', u.code, u.name]));

    help.addRow([]);
    const roleHead = help.addRow(['', 'نقش‌های قابل واگذاری (کلید — نام)', '']);
    roleHead.font = { bold: true };
    roles.filter((r) => !r.isProtected).forEach((r) => help.addRow(['', r.key, r.name]));

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''users-template.xlsx");
    res.send(buffer);
  }),
);

interface ParsedRow {
  rowNumber: number;
  name: string;
  email: string;
  phone?: string;
  departmentId: number | null;
  departmentName: string | null;
  roleIds: number[];
  roleNames: string[];
  status: string;
  password?: string;
}

usersImportRouter.post(
  '/import/preview',
  requirePermission('users.create'),
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    if (!req.file) throw badRequest('فایلی بارگذاری نشده است.');
    const canSetPassword = hasPermission(auth, 'settings.manage');

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(req.file.buffer as unknown as ArrayBuffer);
    } catch {
      throw badRequest('فایل قابل خواندن نیست؛ فقط xlsx معتبر پذیرفته می‌شود.');
    }
    const sheet = wb.getWorksheet('کاربران') ?? wb.worksheets[0];
    if (!sheet) throw badRequest('برگه داده یافت نشد.');

    const { units, roles } = await loadLookups(orgId);
    const existing = await db.user.findMany({ where: { organizationId: orgId }, select: { email: true } });
    const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));
    const seenEmails = new Set<string>();

    const unitByKey = new Map<string, (typeof units)[number]>();
    for (const u of units) {
      if (u.code) unitByKey.set(u.code.trim().toLowerCase(), u);
      unitByKey.set(u.name.trim().toLowerCase(), u);
    }
    const roleByKey = new Map<string, (typeof roles)[number]>();
    for (const r of roles) {
      roleByKey.set(r.key.toLowerCase(), r);
      roleByKey.set(r.name.trim().toLowerCase(), r);
    }
    const defaultRole = roles.find((r) => r.key === 'employee' && !r.isProtected) ?? null;

    const valid: ParsedRow[] = [];
    const invalid: { row: number; errors: string[]; raw: string[] }[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const name = cellText(row, 1);
      const emailRaw = cellText(row, 2);
      const phoneRaw = cellText(row, 3);
      const deptRaw = cellText(row, 4);
      const rolesRaw = cellText(row, 5);
      const statusRaw = cellText(row, 6);
      const passwordRaw = cellText(row, 7);
      if (!name && !emailRaw && !deptRaw) return; // blank row

      const errors: string[] = [];
      const raw = [name, emailRaw, phoneRaw, deptRaw, rolesRaw, statusRaw, passwordRaw ? '••••••' : ''];
      const email = emailRaw.toLowerCase();
      if (!name) errors.push('نام الزامی است.');
      else if (name.length < 2) errors.push('نام باید حداقل ۲ حرف باشد.');
      if (!email) errors.push('ایمیل الزامی است.');
      else if (!EMAIL_RE.test(email)) errors.push('ایمیل معتبر نیست.');
      else if (existingEmails.has(email)) errors.push('کاربری با این ایمیل از قبل وجود دارد.');
      else if (seenEmails.has(email)) errors.push('این ایمیل در فایل تکراری است.');

      let phone: string | undefined;
      if (phoneRaw) {
        phone = normalizeDigits(phoneRaw).replace(/[\s-]/g, '');
        if (!PHONE_RE.test(phone)) errors.push('شماره موبایل معتبر نیست (مثال: 09121234567).');
      }

      let department: (typeof units)[number] | undefined;
      if (deptRaw) {
        department = unitByKey.get(deptRaw.trim().toLowerCase());
        if (!department) errors.push(`دپارتمان «${deptRaw}» در سازمان یافت نشد.`);
      }

      const roleTokens = rolesRaw
        .split(/[,،;|]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const resolvedRoles: (typeof roles)[number][] = [];
      for (const token of roleTokens) {
        const role = roleByKey.get(token.toLowerCase());
        if (!role) errors.push(`نقش «${token}» یافت نشد.`);
        else if (role.isProtected) errors.push(`نقش «${role.name}» قابل واگذاری نیست.`);
        else if (!resolvedRoles.some((r) => r.id === role.id)) resolvedRoles.push(role);
      }
      if (roleTokens.length === 0 && defaultRole) resolvedRoles.push(defaultRole);

      const status = STATUS_MAP[statusRaw.trim()] ?? (statusRaw.trim() ? undefined : 'active');
      if (!status) errors.push(`وضعیت «${statusRaw}» معتبر نیست؛ فعال/غیرفعال/بایگانی.`);

      let password: string | undefined;
      if (passwordRaw) {
        if (!canSetPassword) errors.push('تعیین رمز عبور فقط توسط مدیر ارشد سامانه مجاز است.');
        else if (passwordRaw.length < 8) errors.push('رمز عبور باید حداقل ۸ نویسه باشد.');
        else if (!/\p{L}/u.test(passwordRaw) || !/\p{Nd}/u.test(passwordRaw)) errors.push('رمز عبور باید حرف و رقم داشته باشد.');
        else password = passwordRaw;
      }

      if (errors.length > 0) {
        invalid.push({ row: rowNumber, errors, raw });
        return;
      }
      seenEmails.add(email);
      valid.push({
        rowNumber,
        name,
        email,
        phone,
        departmentId: department?.id ?? null,
        departmentName: department?.name ?? null,
        roleIds: resolvedRoles.map((r) => r.id),
        roleNames: resolvedRoles.map((r) => r.name),
        status: status as string,
        password,
      });
    });

    sendData(res, {
      validCount: valid.length,
      invalidCount: invalid.length,
      valid,
      invalid,
      columns: HEADERS,
      canSetPassword,
      limits: { maxRows: 300 },
    });
  }),
);

usersImportRouter.post(
  '/import/confirm',
  requirePermission('users.create'),
  validateBody(userImportConfirmSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const canSetPassword = hasPermission(auth, 'settings.manage');
    const { rows } = req.body as { rows: ParsedRow[] };
    if (rows.some((r) => r.password) && !canSetPassword) {
      throw forbidden('تعیین رمز عبور فقط توسط مدیر ارشد سامانه مجاز است.');
    }

    // Re-check every id against this organization: the preview is advisory, the
    // confirm request is what actually writes rows.
    const [unitIds, roleIds] = await Promise.all([
      db.organizationUnit.findMany({ where: { organizationId: orgId }, select: { id: true } }),
      db.role.findMany({ where: { organizationId: orgId, isProtected: false }, select: { id: true } }),
    ]);
    const allowedUnits = new Set(unitIds.map((u) => u.id));
    const allowedRoles = new Set(roleIds.map((r) => r.id));
    const defaultRole = await db.role.findFirst({ where: { organizationId: orgId, key: 'employee', isProtected: false }, select: { id: true } });

    const job = await db.importJob.create({ data: { organizationId: orgId, userId: auth.id, type: 'users', status: 'processing', summary: {} } });

    const errors: { row: number; message: string }[] = [];
    const credentials: { name: string; email: string; password: string }[] = [];
    const created: { id: number; name: string; email: string }[] = [];
    const seen = new Set<string>();

    // Hashing is CPU-bound; do it in bounded parallel batches so a 300-row file
    // does not serialise into minutes of bcrypt.
    const passwords = await Promise.all(
      rows.map(async (row) => {
        const plain = row.password ?? generatePassword();
        return { plain, hash: await bcrypt.hash(plain, 12) };
      }),
    );

    for (const [index, row] of rows.entries()) {
      const email = row.email.toLowerCase();
      if (seen.has(email)) {
        errors.push({ row: row.rowNumber ?? index + 2, message: `ایمیل ${email} در همین فایل تکراری است.` });
        continue;
      }
      const duplicate = await db.user.findFirst({ where: { organizationId: orgId, email } });
      if (duplicate) {
        errors.push({ row: row.rowNumber ?? index + 2, message: `کاربری با ایمیل ${email} از قبل وجود دارد.` });
        continue;
      }
      if (row.departmentId && !allowedUnits.has(row.departmentId)) {
        errors.push({ row: row.rowNumber ?? index + 2, message: 'دپارتمان انتخاب‌شده به این سازمان تعلق ندارد.' });
        continue;
      }
      const roles = row.roleIds.filter((id) => allowedRoles.has(id));
      if (roles.length === 0 && defaultRole) roles.push(defaultRole.id);

      const pwd = passwords[index];
      if (!pwd) continue;
      const user = await db.user.create({
        data: {
          organizationId: orgId,
          name: row.name,
          email,
          phone: row.phone ?? null,
          passwordHash: pwd.hash,
          status: row.status,
          departmentId: row.departmentId ?? null,
          roles: roles.length > 0 ? { create: roles.map((roleId) => ({ roleId })) } : undefined,
        },
      });
      seen.add(email);
      created.push({ id: user.id, name: user.name, email: user.email });
      if (!row.password) credentials.push({ name: user.name, email: user.email, password: pwd.plain });
    }

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        summary: { created: created.length, failed: errors.length },
        errors: errors as unknown as Prisma.InputJsonValue,
      },
    });

    await recordAudit({
      organizationId: orgId,
      actorUserId: auth.id,
      action: 'users.imported',
      entityType: 'import_job',
      entityId: job.id,
      after: { created: created.length, failed: errors.length },
    }, req);

    if (errors.length > 0 && created.length === 0) {
      throw conflict('هیچ کاربری ثبت نشد؛ فهرست خطاها را ببینید.', errors);
    }

    sendData(res, {
      importJobId: job.id,
      created: created.length,
      failed: errors.length,
      errors,
      createdUsers: created,
      credentials,
    });
  }),
);
