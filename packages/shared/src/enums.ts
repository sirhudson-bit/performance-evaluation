/**
 * Status and enum catalogs (Persian labels + UI tones).
 *
 * Statuses are stored as strings in the database (not Postgres enums), so a new
 * state never requires a migration. These maps are the single source of truth
 * for how a stored string is shown in the Persian UI.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'info';

export interface EnumEntry {
  fa: string;
  tone: Tone;
}

function entry(fa: string, tone: Tone): EnumEntry {
  return { fa, tone };
}

export const ENUMS = {
  userStatus: {
    active: entry('فعال', 'success'),
    suspended: entry('معلق', 'warning'),
    archived: entry('بایگانی‌شده', 'muted'),
  },

  employeeStatus: {
    active: entry('شاغل', 'success'),
    inactive: entry('غیرفعال', 'warning'),
    terminated: entry('خاتمه همکاری', 'danger'),
    archived: entry('بایگانی‌شده', 'muted'),
  },

  unitStatus: {
    active: entry('فعال', 'success'),
    archived: entry('بایگانی‌شده', 'muted'),
  },

  questionStatus: {
    draft: entry('پیش‌نویس', 'warning'),
    active: entry('فعال', 'success'),
    inactive: entry('غیرفعال', 'muted'),
    archived: entry('بایگانی‌شده', 'muted'),
  },

  formStatus: {
    draft: entry('پیش‌نویس', 'warning'),
    published: entry('منتشرشده', 'success'),
    archived: entry('بایگانی‌شده', 'muted'),
  },

  formVersionStatus: {
    draft: entry('پیش‌نویس', 'warning'),
    in_review: entry('در حال بازبینی', 'info'),
    published: entry('منتشرشده', 'success'),
    archived: entry('بایگانی‌شده', 'muted'),
  },

  cycleStatus: {
    draft: entry('پیش‌نویس', 'muted'),
    active: entry('در جریان', 'info'),
    in_review: entry('در حال بررسی', 'warning'),
    published: entry('منتشرشده', 'success'),
    closed: entry('بسته‌شده', 'muted'),
    cancelled: entry('لغو‌شده', 'danger'),
  },

  assignmentStatus: {
    draft: entry('پیش‌نویس', 'muted'),
    assigned: entry('ارجاع‌شده', 'info'),
    in_progress: entry('در حال تکمیل', 'info'),
    submitted: entry('ارسال‌شده', 'warning'),
    under_review: entry('در حال بررسی', 'warning'),
    returned_for_revision: entry('بازگشت برای اصلاح', 'danger'),
    approved: entry('تأییدشده', 'success'),
    published: entry('منتشرشده', 'success'),
    reopened: entry('بازگشایی‌شده', 'warning'),
    appealed: entry('دارای اعتراض', 'warning'),
    cancelled: entry('لغو‌شده', 'muted'),
  },

  appealStatus: {
    open: entry('ثبت‌شده', 'info'),
    under_review: entry('در حال رسیدگی', 'warning'),
    accepted: entry('پذیرفته‌شده', 'success'),
    rejected: entry('رد‌شده', 'danger'),
    withdrawn: entry('انصراف', 'muted'),
  },

  compensationStatus: {
    proposed: entry('پیشنهادشده', 'info'),
    under_review: entry('در حال بررسی', 'warning'),
    approved: entry('تأییدشده', 'success'),
    rejected: entry('رد‌شده', 'danger'),
    cancelled: entry('لغو‌شده', 'muted'),
  },

  jobStatus: {
    pending: entry('در انتظار', 'info'),
    running: entry('در حال اجرا', 'info'),
    completed: entry('تکمیل‌شده', 'success'),
    failed: entry('ناموفق', 'danger'),
    dead: entry('متوقف‌شده', 'danger'),
    cancelled: entry('لغو‌شده', 'muted'),
  },

  improvementPlanStatus: {
    draft: entry('پیش‌نویس', 'muted'),
    active: entry('در جریان', 'info'),
    completed: entry('تکمیل‌شده', 'success'),
    cancelled: entry('لغو‌شده', 'muted'),
  },

  ticketStatus: {
    open: entry('باز', 'info'),
    in_progress: entry('در حال بررسی', 'warning'),
    answered: entry('پاسخ داده شده', 'success'),
    closed: entry('بسته', 'muted'),
  },
} as const;

/** All valid values for a given enum key. */
export function enumValues(key: keyof typeof ENUMS): string[] {
  return Object.keys(ENUMS[key]);
}

export function labelOf(key: keyof typeof ENUMS, value: string | null | undefined): string {
  if (!value) return '—';
  const group = ENUMS[key] as Record<string, EnumEntry | undefined>;
  return group[value]?.fa ?? value;
}

export function toneOf(key: keyof typeof ENUMS, value: string | null | undefined): Tone {
  if (!value) return 'muted';
  const group = ENUMS[key] as Record<string, EnumEntry | undefined>;
  return group[value]?.tone ?? 'muted';
}

// ---------------------------------------------------------------------------
// Non-status enums
// ---------------------------------------------------------------------------

export const ANSWER_TYPES = {
  rating_5: 'طیف پنج‌گزینه‌ای',
  numeric_scale: 'طیف عددی',
  single_choice: 'انتخاب تک‌گزینه‌ای',
  multi_choice: 'انتخاب چندگزینه‌ای',
  percentage: 'درصد',
  numeric: 'ورود عدد',
  short_text: 'متن کوتاه',
  long_text: 'متن بلند',
  yes_no: 'بله/خیر',
} as const;

export type AnswerType = keyof typeof ANSWER_TYPES;

/** Answer types that can carry a numeric score. Text types never auto-score. */
export const SCORABLE_ANSWER_TYPES: AnswerType[] = [
  'rating_5',
  'numeric_scale',
  'single_choice',
  'multi_choice',
  'percentage',
  'numeric',
  'yes_no',
];

export const EVALUATOR_ROLES = {
  self: 'خودارزیابی',
  manager: 'مدیر مستقیم',
  peer: 'همکار',
  report: 'زیرمجموعه',
  hr: 'منابع انسانی',
  other: 'سایر',
} as const;

export type EvaluatorRole = keyof typeof EVALUATOR_ROLES;

export const CONFIDENTIALITY_MODES = {
  named: 'پاسخ‌های نام‌دار برای نقش‌های مجاز',
  confidential: 'محرمانه (هویت فقط برای نقش‌های ویژه)',
  anonymous: 'ناشناس (هویت در گزارش‌های عادی نمایش داده نمی‌شود)',
} as const;

export type ConfidentialityMode = keyof typeof CONFIDENTIALITY_MODES;

export const COMPENSATION_MODES = {
  recommendation: 'حالت پیشنهاد (تصمیم نهایی با انسان)',
  policy: 'محاسبه بر پایه سیاست (پیشنهاد نظام‌مند)',
} as const;

export type CompensationMode = keyof typeof COMPENSATION_MODES;

export const PERIOD_TYPES = {
  monthly: 'ماهانه',
  quarterly: 'فصلی',
  annual: 'سالانه',
  custom: 'بازه دلخواه',
} as const;

export type PeriodType = keyof typeof PERIOD_TYPES;

export const SCORING_MODEL = 'normalized_weighted_average';

export const TICKET_CATEGORIES = {
  general: 'عمومی',
  evaluation: 'ارزیابی',
  technical: 'فنی',
  other: 'سایر',
} as const;

export const TICKET_PRIORITIES = {
  low: 'کم',
  normal: 'عادی',
  high: 'بالا',
} as const;
