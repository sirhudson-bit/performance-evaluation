import { z } from 'zod';
import { isoDate } from './common.js';

export const saveResponsesSchema = z.object({
  answers: z
    .array(
      z.object({
        formQuestionId: z.coerce.number().int().positive(),
        value: z.any(),
        isNotApplicable: z.boolean().default(false),
      }),
    )
    .max(500),
});

export const reviewSchema = z.object({
  action: z.enum(['review', 'approve', 'return']),
  comment: z.string().trim().max(2000).optional(),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(3, 'دلیل بازگشایی الزامی است.').max(1000),
});

export const publishSchema = z.object({
  cycleId: z.coerce.number().int().positive(),
  employeeIds: z.array(z.coerce.number().int().positive()).optional(),
  reason: z.string().trim().max(1000).optional(),
});

export const appealCreateSchema = z.object({
  cycleId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(5, 'دلیل اعتراض الزامی است.').max(2000),
});

export const appealDecideSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  reason: z.string().trim().min(3, 'شرح تصمیم الزامی است.').max(2000),
  scoreAfter: z.coerce.number().min(0).max(100).nullable().optional(),
});

export const improvementPlanSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  cycleId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(2, 'عنوان برنامه الزامی است.').max(200),
  actions: z.array(z.record(z.any())).default([]),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).default('draft'),
  dueDate: isoDate.optional(),
});
