/**
 * Seeded role catalog.
 *
 * Roles are rows in the database (composed from permissions at runtime), so an
 * administrator can add custom roles. These definitions are the seed and the
 * source of truth for the five default roles. `permissions: null` means "every
 * permission" (reserved for the protected platform role).
 */

import { PERMISSION_NAMES } from './permissions.js';

export interface RoleDef {
  key: string;
  nameFa: string;
  descriptionFa: string;
  /** null = all permissions. */
  permissions: string[] | null;
  /** Protected roles cannot be edited or assigned through the API. */
  protected: boolean;
}

const HR: string[] = [
  'dashboard.view',
  'profile.view_self', 'profile.edit_self',
  'organization.view',
  'employees.view', 'employees.view_all', 'employees.create', 'employees.edit', 'employees.archive', 'employees.manage_info',
  'users.view', 'users.create', 'users.edit',
  'roles.view',
  'questions.view', 'questions.create', 'questions.edit', 'questions.archive',
  'forms.view', 'forms.create', 'forms.edit', 'forms.publish', 'forms.archive',
  'cycles.view', 'cycles.create', 'cycles.edit', 'cycles.close',
  'assignments.view', 'assignments.manage',
  'evaluations.view_raw', 'evaluations.review', 'evaluations.approve', 'evaluations.return',
  'evaluations.publish', 'evaluations.reopen',
  'scoring.view', 'scoring.configure',
  'reports.view', 'reports.export', 'imports.manage',
  'compensation.view', 'compensation.policies_view', 'compensation.recommend', 'compensation.approve',
  'appeals.view', 'appeals.manage',
  'improvement_plans.view', 'improvement_plans.manage',
  'ai.use',
  'help.view', 'help.manage',
  'tickets.view', 'tickets.manage',
  'processes.view', 'processes.manage',
  'agreements.view', 'agreements.manage',
  'audit.view',
  'settings.view',
  'compliance.manage',
];

const MANAGER: string[] = [
  'dashboard.view',
  'profile.view_self', 'profile.edit_self',
  'organization.view',
  'employees.view',
  'assignments.view',
  'evaluations.view_own', 'evaluations.fill', 'evaluations.submit',
  'reports.view',
  'compensation.view', 'compensation.recommend',
  'appeals.view',
  'improvement_plans.view', 'improvement_plans.manage',
  'ai.use',
  'help.view',
  'tickets.view',
  'processes.view',
  'agreements.view', 'agreements.manage',
];

const EMPLOYEE: string[] = [
  'dashboard.view',
  'profile.view_self', 'profile.edit_self',
  'evaluations.view_own', 'evaluations.fill', 'evaluations.submit',
  'appeals.submit',
  'improvement_plans.view',
  'ai.use',
  'help.view',
  'tickets.view',
  'agreements.view',
];

export const ROLE_DEFS: RoleDef[] = [
  {
    key: 'platform_super_admin',
    nameFa: 'مدیر ارشد سامانه',
    descriptionFa: 'دسترسی کامل به همه بخش‌ها؛ قابل ویرایش و واگذاری نیست.',
    permissions: null,
    protected: true,
  },
  {
    key: 'system_admin',
    nameFa: 'مدیر سامانه',
    descriptionFa: 'مدیریت کاربران، نقش‌ها، تنظیمات و کل فرایند ارزیابی.',
    permissions: [...PERMISSION_NAMES],
    protected: false,
  },
  {
    key: 'hr_manager',
    nameFa: 'مدیر منابع انسانی',
    descriptionFa: 'مدیریت پرسش‌ها، فرم‌ها، دوره‌ها، بررسی و انتشار نتایج و گزارش‌ها.',
    permissions: HR,
    protected: false,
  },
  {
    key: 'department_manager',
    nameFa: 'مدیر مستقیم',
    descriptionFa: 'ارزیابی کارکنان تحت مدیریت خود و مشاهده نتایج مجاز.',
    permissions: MANAGER,
    protected: false,
  },
  {
    key: 'employee',
    nameFa: 'کارمند',
    descriptionFa: 'تکمیل ارزیابی خود و مشاهده نتایج منتشرشده خود.',
    permissions: EMPLOYEE,
    protected: false,
  },
];

export const PROTECTED_ROLE_KEYS: string[] = ROLE_DEFS.filter((r) => r.protected).map((r) => r.key);

export function isProtectedRole(key: string): boolean {
  return PROTECTED_ROLE_KEYS.includes(key);
}
