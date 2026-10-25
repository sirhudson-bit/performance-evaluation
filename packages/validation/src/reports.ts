import { z } from 'zod';

export const EXPORT_REPORTS = [
  'executive_summary',
  'employee_results',
  'answers_detail',
  'responses_by_user',
  'scores_breakdown',
  'comparison',
  'completion_status',
  'appeals',
  'compensation',
] as const;

export const exportFiltersSchema = z.object({
  cycleId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  unitId: z.coerce.number().int().positive().optional(),
  managerId: z.coerce.number().int().positive().optional(),
  status: z.string().trim().max(40).optional(),
  scoreMin: z.coerce.number().min(0).max(100).optional(),
  scoreMax: z.coerce.number().min(0).max(100).optional(),
});

export const exportRequestSchema = z.object({
  report: z.enum(EXPORT_REPORTS),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
  filters: exportFiltersSchema.default({}),
  columns: z.array(z.string().max(60)).optional(),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
