import { z } from 'zod';
import { isoDate } from './common.js';

export const periodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(['monthly', 'quarterly', 'annual', 'custom']).default('custom'),
  startDate: isoDate,
  endDate: isoDate,
  status: z.enum(['active', 'archived']).default('active'),
});

export const cycleSchema = z.object({
  name: z.string().trim().min(2, 'نام دوره الزامی است.').max(160),
  periodId: z.coerce.number().int().positive().nullable().optional(),
  formVersionId: z.coerce.number().int().positive(),
  workflowId: z.coerce.number().int().positive().nullable().optional(),
  scoringPolicyId: z.coerce.number().int().positive().nullable().optional(),
  compensationPolicyId: z.coerce.number().int().positive().nullable().optional(),
  processId: z.coerce.number().int().positive().nullable().optional(),
  confidentialityMode: z.enum(['named', 'confidential', 'anonymous']).default('named'),
  selfAssessment: z.boolean().default(false),
  appealEnabled: z.boolean().default(false),
  startDate: isoDate,
  endDate: isoDate,
  submissionDeadline: isoDate.optional(),
  publicationRule: z.enum(['auto_on_approve', 'manual']).default('auto_on_approve'),
  config: z.record(z.any()).default({}),
});

export const cycleStatusSchema = z.object({
  status: z.enum(['draft', 'active', 'in_review', 'published', 'closed', 'cancelled']),
  reason: z.string().trim().max(500).optional(),
});

export const assignmentSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  evaluatorRole: z.enum(['self', 'manager', 'peer', 'report', 'hr', 'other']),
  evaluatorUserId: z.coerce.number().int().positive().nullable().optional(),
  evaluatorEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  weight: z.coerce.number().min(0).max(1000).default(0),
  dueDate: isoDate.optional(),
});

/**
 * Bulk assignment. `strategy` decides who becomes the manager evaluator:
 *  - `manager_history`: the employee's manager as of the cycle start date.
 *  - `current_manager`: the employee's current manager.
 */
export const bulkAssignSchema = z.object({
  employeeIds: z.array(z.coerce.number().int().positive()).min(1),
  evaluatorRoles: z.array(z.enum(['self', 'manager', 'peer', 'report', 'hr'])).min(1),
  strategy: z.enum(['manager_history', 'current_manager']).default('manager_history'),
  weights: z.record(z.coerce.number().min(0)).optional(),
  dueDate: isoDate.optional(),
});
