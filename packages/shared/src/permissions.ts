/**
 * Permission catalog.
 *
 * This constant is the single source of truth for what a permission string
 * means. It is seeded into the database (`permissions` table) so roles can be
 * composed at runtime without a code change, but the API only ever accepts
 * names that appear here — a crafted request cannot invent a permission.
 *
 * Authorization is enforced on the backend for every protected operation;
 * hiding a UI element is never an authorization control.
 */

export interface PermissionDef {
  name: string;
  category: string;
  descriptionFa: string;
}

export const PERMISSION_DEFS: PermissionDef[] = [
  // Dashboard
  { name: 'dashboard.view', category: 'dashboard', descriptionFa: 'مشاهده داشبورد' },

  // Own profile
  { name: 'profile.view_self', category: 'profile', descriptionFa: 'مشاهده پروفایل خود' },
  { name: 'profile.edit_self', category: 'profile', descriptionFa: 'ویرایش پروفایل خود' },

  // Organization & people
  { name: 'organization.view', category: 'organization', descriptionFa: 'مشاهده ساختار سازمانی' },
  { name: 'organization.manage', category: 'organization', descriptionFa: 'مدیریت واحدها و سمت‌ها' },
  { name: 'employees.view', category: 'employees', descriptionFa: 'مشاهده کارکنان' },
  { name: 'employees.view_all', category: 'employees', descriptionFa: 'مشاهده همه کارکنان سازمان' },
  { name: 'employees.create', category: 'employees', descriptionFa: 'ایجاد کارمند' },
  { name: 'employees.edit', category: 'employees', descriptionFa: 'ویرایش کارمند' },
  { name: 'employees.archive', category: 'employees', descriptionFa: 'بایگانی کارمند' },
  { name: 'employees.manage_info', category: 'employees', descriptionFa: 'مدیریت اطلاعات پرسنلی و مدیران' },

  // Users, roles, permissions
  { name: 'users.view', category: 'users', descriptionFa: 'مشاهده کاربران' },
  { name: 'users.create', category: 'users', descriptionFa: 'ایجاد کاربر' },
  { name: 'users.edit', category: 'users', descriptionFa: 'ویرایش کاربر' },
  { name: 'users.archive', category: 'users', descriptionFa: 'غیرفعال‌سازی کاربر' },
  { name: 'roles.view', category: 'roles', descriptionFa: 'مشاهده نقش‌ها' },
  { name: 'roles.manage', category: 'roles', descriptionFa: 'مدیریت نقش‌ها و دسترسی‌ها' },

  // Question bank
  { name: 'questions.view', category: 'questions', descriptionFa: 'مشاهده بانک پرسش‌ها' },
  { name: 'questions.create', category: 'questions', descriptionFa: 'ایجاد پرسش' },
  { name: 'questions.edit', category: 'questions', descriptionFa: 'ویرایش پرسش' },
  { name: 'questions.archive', category: 'questions', descriptionFa: 'بایگانی پرسش' },

  // Forms
  { name: 'forms.view', category: 'forms', descriptionFa: 'مشاهده فرم‌ها' },
  { name: 'forms.create', category: 'forms', descriptionFa: 'ایجاد فرم' },
  { name: 'forms.edit', category: 'forms', descriptionFa: 'ویرایش پیش‌نویس فرم' },
  { name: 'forms.publish', category: 'forms', descriptionFa: 'انتشار نسخه فرم' },
  { name: 'forms.archive', category: 'forms', descriptionFa: 'بایگانی فرم' },

  // Cycles
  { name: 'cycles.view', category: 'cycles', descriptionFa: 'مشاهده دوره‌های ارزیابی' },
  { name: 'cycles.create', category: 'cycles', descriptionFa: 'ایجاد دوره ارزیابی' },
  { name: 'cycles.edit', category: 'cycles', descriptionFa: 'ویرایش دوره ارزیابی' },
  { name: 'cycles.close', category: 'cycles', descriptionFa: 'بستن دوره ارزیابی' },

  // Assignments
  { name: 'assignments.view', category: 'assignments', descriptionFa: 'مشاهده ارجاع‌های ارزیابی' },
  { name: 'assignments.manage', category: 'assignments', descriptionFa: 'ارجاع و مدیریت ارزیابان' },

  // Evaluations
  { name: 'evaluations.view_own', category: 'evaluations', descriptionFa: 'مشاهده ارزیابی‌های خود' },
  { name: 'evaluations.fill', category: 'evaluations', descriptionFa: 'تکمیل فرم ارزیابی' },
  { name: 'evaluations.submit', category: 'evaluations', descriptionFa: 'ارسال ارزیابی' },
  { name: 'evaluations.view_raw', category: 'evaluations', descriptionFa: 'مشاهده پاسخ‌های خام' },
  { name: 'evaluations.review', category: 'evaluations', descriptionFa: 'بررسی ارزیابی' },
  { name: 'evaluations.approve', category: 'evaluations', descriptionFa: 'تأیید ارزیابی' },
  { name: 'evaluations.return', category: 'evaluations', descriptionFa: 'بازگرداندن ارزیابی برای اصلاح' },
  { name: 'evaluations.publish', category: 'evaluations', descriptionFa: 'انتشار نتایج' },
  { name: 'evaluations.reopen', category: 'evaluations', descriptionFa: 'بازگشایی ارزیابی منتشرشده' },

  // Scoring
  { name: 'scoring.view', category: 'scoring', descriptionFa: 'مشاهده سیاست‌های امتیازدهی' },
  { name: 'scoring.configure', category: 'scoring', descriptionFa: 'تنظیم سیاست امتیازدهی' },

  // Reports & export
  { name: 'reports.view', category: 'reports', descriptionFa: 'مشاهده گزارش‌ها' },
  { name: 'reports.export', category: 'reports', descriptionFa: 'خروجی اکسل' },
  { name: 'imports.manage', category: 'reports', descriptionFa: 'ورود اطلاعات از اکسل' },

  // Compensation & promotion
  { name: 'compensation.view', category: 'compensation', descriptionFa: 'مشاهده جبران خدمات' },
  { name: 'compensation.policies_view', category: 'compensation', descriptionFa: 'مشاهده سیاست‌های جبران خدمات' },
  { name: 'compensation.policies_manage', category: 'compensation', descriptionFa: 'مدیریت سیاست‌های جبران خدمات' },
  { name: 'compensation.recommend', category: 'compensation', descriptionFa: 'تهیه پیشنهاد جبران خدمات' },
  { name: 'compensation.approve', category: 'compensation', descriptionFa: 'تأیید پیشنهاد جبران خدمات' },

  // Appeals & improvement plans
  { name: 'appeals.submit', category: 'appeals', descriptionFa: 'ثبت درخواست اعتراض' },
  { name: 'appeals.view', category: 'appeals', descriptionFa: 'مشاهده اعتراض‌ها' },
  { name: 'appeals.manage', category: 'appeals', descriptionFa: 'رسیدگی به اعتراض‌ها' },
  { name: 'improvement_plans.view', category: 'improvement_plans', descriptionFa: 'مشاهده برنامه‌های بهبود' },
  { name: 'improvement_plans.manage', category: 'improvement_plans', descriptionFa: 'مدیریت برنامه‌های بهبود' },

  // AI
  { name: 'ai.use', category: 'ai', descriptionFa: 'استفاده از دستیار هوشمند' },
  { name: 'ai.view_usage', category: 'ai', descriptionFa: 'مشاهده مصرف هوش مصنوعی' },
  { name: 'ai.manage', category: 'ai', descriptionFa: 'مدیریت سرویس‌های هوش مصنوعی' },

  // Help, legal, privacy
  { name: 'help.view', category: 'help', descriptionFa: 'مشاهده راهنما' },
  { name: 'help.manage', category: 'help', descriptionFa: 'مدیریت محتوای راهنما' },
  { name: 'legal.manage', category: 'legal', descriptionFa: 'مدیریت متون حقوقی و حریم خصوصی' },

  // Messaging / support tickets
  { name: 'tickets.view', category: 'tickets', descriptionFa: 'مشاهده پیام‌ها و تیکت‌ها' },
  { name: 'tickets.manage', category: 'tickets', descriptionFa: 'پاسخ و مدیریت تیکت‌ها' },

  // Performance management processes & agreements
  { name: 'processes.view', category: 'performance', descriptionFa: 'مشاهده فرایندهای مدیریت عملکرد' },
  { name: 'processes.manage', category: 'performance', descriptionFa: 'مدیریت فرایندها، مراحل و ابعاد' },
  { name: 'agreements.view', category: 'performance', descriptionFa: 'مشاهده توافق‌نامه‌های عملکرد' },
  { name: 'agreements.manage', category: 'performance', descriptionFa: 'مدیریت توافق‌نامه‌های عملکرد' },

  // Audit, settings, compliance
  { name: 'audit.view', category: 'audit', descriptionFa: 'مشاهده گزارش رخدادها' },
  { name: 'settings.view', category: 'settings', descriptionFa: 'مشاهده تنظیمات' },
  { name: 'settings.manage', category: 'settings', descriptionFa: 'مدیریت تنظیمات' },
  { name: 'compliance.manage', category: 'compliance', descriptionFa: 'مدیریت اطلاعات هویتی و انطباق' },
  { name: 'jobs.manage', category: 'ops', descriptionFa: 'مدیریت کارهای پس‌زمینه' },
];

export type Permission = (typeof PERMISSION_DEFS)[number]['name'];

export const PERMISSION_NAMES: string[] = PERMISSION_DEFS.map((p) => p.name);

/** Names of every permission category, for grouping in the admin role editor. */
export const PERMISSION_CATEGORIES: string[] = Array.from(
  new Set(PERMISSION_DEFS.map((p) => p.category)),
);

export function isKnownPermission(name: string): boolean {
  return PERMISSION_NAMES.includes(name);
}
