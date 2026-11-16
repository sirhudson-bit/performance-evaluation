/** Shared, serializable data for the process builder (wizard + editor). */

export const MODEL_LABELS: Record<string, string> = {
  weighted_360: 'ارزیابی ۳۶۰ درجه وزن‌دار',
  manager_only: 'فقط مدیر',
  self_and_manager: 'خودارزیابی و مدیر',
  management_by_objectives: 'مدیریت بر مبنای اهداف (MBO)',
};

export const OWNER_OPTIONS: { key: string; label: string }[] = [
  { key: 'employee', label: 'کارمند' },
  { key: 'department_manager', label: 'مدیر مستقیم' },
  { key: 'hr_manager', label: 'منابع انسانی' },
  { key: 'system_admin', label: 'مدیر سامانه' },
];

export const STATUS_LABELS: Record<string, string> = { draft: 'پیش‌نویس', active: 'فعال', archived: 'بایگانی' };

export interface StepDraft {
  key: string;
  name: string;
  ownerRoleKey: string;
  slaDays: string;
}

export interface DimensionDraft {
  key: string;
  name: string;
  weight: string;
  ownerRoleKey: string;
}

export interface ProcessPreset {
  id: string;
  title: string;
  description: string;
  evaluationModel: string;
  steps: Omit<StepDraft, 'key'>[];
  dimensions: Omit<DimensionDraft, 'key'>[];
}

/**
 * Ready-made structures so a first process is two clicks, not twenty fields.
 * The operator can still edit every row afterwards — a preset only seeds the
 * draft.
 */
export const PROCESS_PRESETS: ProcessPreset[] = [
  {
    id: '360-standard',
    title: '۳۶۰ درجه استاندارد',
    description: 'خودارزیابی، ارزیابی مدیر، بازبینی منابع انسانی و انتشار — با چهار بعد متداول.',
    evaluationModel: 'weighted_360',
    steps: [
      { name: 'خودارزیابی کارمند', ownerRoleKey: 'employee', slaDays: '5' },
      { name: 'ارزیابی مدیر مستقیم', ownerRoleKey: 'department_manager', slaDays: '7' },
      { name: 'بازبینی منابع انسانی', ownerRoleKey: 'hr_manager', slaDays: '5' },
      { name: 'انتشار نتایج', ownerRoleKey: 'system_admin', slaDays: '3' },
    ],
    dimensions: [
      { name: 'شایستگی فنی و تخصصی', weight: '35', ownerRoleKey: 'department_manager' },
      { name: 'همکاری و کار تیمی', weight: '25', ownerRoleKey: 'department_manager' },
      { name: 'دستیابی به اهداف', weight: '30', ownerRoleKey: 'department_manager' },
      { name: 'ابتکار و نوآوری', weight: '10', ownerRoleKey: 'hr_manager' },
    ],
  },
  {
    id: 'manager-only',
    title: 'فقط مدیر (ساده)',
    description: 'کوتاه‌ترین چرخه: ارزیابی مدیر و تأیید منابع انسانی.',
    evaluationModel: 'manager_only',
    steps: [
      { name: 'ارزیابی مدیر مستقیم', ownerRoleKey: 'department_manager', slaDays: '7' },
      { name: 'تأیید منابع انسانی', ownerRoleKey: 'hr_manager', slaDays: '3' },
    ],
    dimensions: [
      { name: 'کیفیت کار', weight: '40', ownerRoleKey: 'department_manager' },
      { name: 'بهره‌وری و مهلت‌ها', weight: '40', ownerRoleKey: 'department_manager' },
      { name: 'رفتار حرفه‌ای', weight: '20', ownerRoleKey: 'department_manager' },
    ],
  },
  {
    id: 'mbo',
    title: 'مدیریت بر مبنای اهداف (MBO)',
    description: 'تعیین اهداف، پیشرفت میان‌دوره و ارزیابی پایان دوره.',
    evaluationModel: 'management_by_objectives',
    steps: [
      { name: 'تعیین اهداف دوره', ownerRoleKey: 'department_manager', slaDays: '5' },
      { name: 'بازبینی پیشرفت میان‌دوره', ownerRoleKey: 'department_manager', slaDays: '30' },
      { name: 'ارزیابی پایان دوره', ownerRoleKey: 'department_manager', slaDays: '7' },
    ],
    dimensions: [
      { name: 'تحقق اهداف کمی', weight: '60', ownerRoleKey: 'department_manager' },
      { name: 'شایستگی‌های رفتاری', weight: '25', ownerRoleKey: 'department_manager' },
      { name: 'توسعه فردی', weight: '15', ownerRoleKey: 'hr_manager' },
    ],
  },
];

export function sumWeights(dimensions: { weight: string }[]): number {
  return dimensions.reduce((total, d) => total + (Number(d.weight) || 0), 0);
}
