import { z } from 'zod';

export const formSchema = z.object({
  name: z.string().trim().min(2, 'نام فرم الزامی است.').max(200),
  description: z.string().trim().max(1000).optional(),
});

export const sectionSchema = z.object({
  title: z.string().trim().min(2, 'عنوان بخش الزامی است.').max(200),
  description: z.string().trim().max(1000).optional(),
  weight: z.coerce.number().min(0).max(1000).default(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const formQuestionSchema = z.object({
  sectionId: z.coerce.number().int().positive(),
  questionId: z.coerce.number().int().positive(),
  weight: z.coerce.number().min(0).max(1000).default(1),
  required: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  condition: z.record(z.any()).nullable().optional(),
});

export const formQuestionUpdateSchema = z.object({
  weight: z.coerce.number().min(0).max(1000).optional(),
  required: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  condition: z.record(z.any()).nullable().optional(),
});

/** Reorder any ordered collection by providing the full ordered id list. */
export const reorderSchema = z.object({
  orderedIds: z.array(z.coerce.number().int().positive()).min(1),
});

export const formVersionUpdateSchema = z.object({
  confidentialityMode: z.enum(['named', 'confidential', 'anonymous']).optional(),
  selfAssessment: z.boolean().optional(),
  anonymityThreshold: z.coerce.number().int().min(1).max(50).optional(),
  scoringPolicyId: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const previewAnswerSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  value: z.any(),
  isNotApplicable: z.boolean().default(false),
});

export const scoringPreviewSchema = z.object({
  answers: z.array(previewAnswerSchema).default([]),
});
