import { z } from 'zod';
import { ANSWER_TYPES } from '@pe/shared';

const answerType = z.string().refine((v) => v in ANSWER_TYPES, 'نوع پاسخ نامعتبر است.');
const evaluatorRole = z.enum(['self', 'manager', 'peer', 'report', 'hr', 'other']);
const subjectType = z.enum(['self', 'manager', 'employee', 'peer', 'report', 'other']);

export const questionCategorySchema = z.object({
  name: z.string().trim().min(2, 'نام دسته الزامی است.').max(120),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(['active', 'archived']).default('active'),
});

export const questionOptionSchema = z.object({
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(60),
  score: z.coerce.number().min(0).max(100).nullable().optional(),
  isNotApplicable: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const questionSchema = z.object({
  stableKey: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'شناسه پایدار فقط شامل حروف کوچک، رقم و زیرخط است.'),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(2, 'عنوان پرسش الزامی است.').max(200),
  text: z.string().trim().min(2, 'متن پرسش الزامی است.').max(2000),
  guidance: z.string().trim().max(2000).optional(),
  subjectType: subjectType.default('employee'),
  respondentRoles: z.array(evaluatorRole).default(['manager']),
  answerType,
  required: z.boolean().default(true),
  weight: z.coerce.number().min(0).max(1000).default(1),
  scoring: z.record(z.any()).default({}),
  condition: z.record(z.any()).nullable().optional(),
  options: z.array(questionOptionSchema).default([]),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const questionUpdateSchema = questionSchema.partial();
