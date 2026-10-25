import { z } from 'zod';
import { isoDate } from './common.js';

/** A target group is a unit, a role or a specific employee. */
export const targetGroupSchema = z.object({
  type: z.enum(['unit', 'role', 'employee']),
  id: z.coerce.number().int().positive().optional(),
  key: z.string().trim().max(60).optional(),
});

export const processSchema = z.object({
  name: z.string().trim().min(2, 'نام فرایند الزامی است.').max(160),
  description: z.string().trim().max(2000).optional(),
  evaluationModel: z.enum(['weighted_360', 'manager_only', 'self_and_manager', 'management_by_objectives']).default('weighted_360'),
  targetGroups: z.array(targetGroupSchema).default([]),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
});

export const processStepSchema = z.object({
  name: z.string().trim().min(2, 'نام مرحله الزامی است.').max(160),
  description: z.string().trim().max(2000).optional(),
  order: z.coerce.number().int().min(0).default(0),
  ownerType: z.enum(['role', 'user', 'unit']).default('role'),
  ownerRoleKey: z.string().trim().max(60).optional(),
  ownerUserId: z.coerce.number().int().positive().nullable().optional(),
  ownerUnitId: z.coerce.number().int().positive().nullable().optional(),
  slaDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
});

export const processDimensionSchema = z.object({
  name: z.string().trim().min(2, 'نام بعد الزامی است.').max(160),
  description: z.string().trim().max(2000).optional(),
  weight: z.coerce.number().min(0).max(1000).default(0),
  ownerRoleKey: z.string().trim().max(60).optional(),
  ownerUserId: z.coerce.number().int().positive().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const cycleStepSchema = z.object({
  name: z.string().trim().min(2, 'نام مرحله الزامی است.').max(160),
  order: z.coerce.number().int().min(0).default(0),
  processStepId: z.coerce.number().int().positive().nullable().optional(),
  ownerRoleKey: z.string().trim().max(60).optional(),
  ownerUserId: z.coerce.number().int().positive().nullable().optional(),
  dueDate: isoDate.optional(),
  status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
});

export const indicatorSchema = z.object({
  name: z.string().trim().min(1, 'نام شاخص الزامی است.').max(160),
  description: z.string().trim().max(2000).optional(),
  unit: z.string().trim().max(40).optional(),
  targetValue: z.coerce.number().nullable().optional(),
  actualValue: z.coerce.number().nullable().optional(),
  weight: z.coerce.number().min(0).max(1000).default(1),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const agreementSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  cycleId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(2, 'عنوان توافق‌نامه الزامی است.').max(200),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).default('draft'),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  indicators: z.array(indicatorSchema).default([]),
});

export const agreementIndicatorUpdateSchema = z.object({
  actualValue: z.coerce.number().nullable().optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
});

export const agreementEntrySchema = z.object({
  type: z.enum(['event', 'feedback', 'progress']).default('feedback'),
  body: z.string().trim().min(1, 'متن الزامی است.').max(4000),
});
