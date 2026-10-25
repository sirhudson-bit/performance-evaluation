import { z } from 'zod';
import { isoDate } from './common.js';

export const compensationPolicySchema = z.object({
  name: z.string().trim().min(2, 'نام سیاست الزامی است.').max(200),
  mode: z.enum(['recommendation', 'policy']).default('recommendation'),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.optional(),
  config: z
    .object({
      rules: z
        .array(
          z.object({
            minScore: z.coerce.number().min(0).max(100),
            maxScore: z.coerce.number().min(0).max(100),
            type: z.enum(['percent', 'amount', 'promotion']),
            value: z.coerce.number().min(0),
            min: z.coerce.number().min(0).optional(),
            max: z.coerce.number().min(0).optional(),
          }),
        )
        .default([]),
      budget: z.coerce.number().min(0).optional(),
      eligibility: z.record(z.any()).default({}),
      approvalRoleKeys: z.array(z.string()).default([]),
      exceptions: z.string().max(2000).optional(),
    })
    .default({}),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
});

export const recommendationSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  cycleId: z.coerce.number().int().positive().nullable().optional(),
  mode: z.enum(['recommendation', 'policy']).default('recommendation'),
  proposedType: z.enum(['percent', 'amount', 'promotion']).nullable().optional(),
  proposedValue: z.coerce.number().min(0).nullable().optional(),
  rationale: z.string().trim().max(2000).optional(),
});

/** A proposer may edit a proposal only while it is still undecided. */
export const recommendationUpdateSchema = recommendationSchema.partial();

export const generateRecommendationsSchema = z.object({
  cycleId: z.coerce.number().int().positive(),
  compensationPolicyId: z.coerce.number().int().positive(),
});

export const compensationDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(2000).optional(),
  isOverride: z.boolean().default(false),
  overrideReason: z.string().trim().max(2000).optional(),
  /** When an override changes the proposed value, the new value must be given. */
  overrideValue: z.coerce.number().min(0).nullable().optional(),
});
