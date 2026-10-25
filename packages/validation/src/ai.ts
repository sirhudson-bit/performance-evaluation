import { z } from 'zod';

export const aiProviderSchema = z.object({
  name: z.string().trim().min(2, 'نام سرویس الزامی است.').max(120),
  type: z.enum(['openai_compatible', 'google_gemini', 'offline']),
  baseUrl: z.string().trim().url('آدرس پایه معتبر نیست.').max(300).optional().or(z.literal('').transform(() => undefined)),
  /** Secret. Stored encrypted; never returned to the client. */
  apiKey: z.string().trim().max(400).optional().or(z.literal('').transform(() => undefined)),
  enabled: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  isFallback: z.boolean().default(false),
  config: z.record(z.any()).default({}),
});

export const aiProviderUpdateSchema = aiProviderSchema.partial();

export const aiModelSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  modelId: z.string().trim().min(1, 'شناسه مدل الزامی است.').max(160),
  label: z.string().trim().max(160).optional(),
  maxTokens: z.coerce.number().int().min(1).max(32000).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(120000).default(30000),
  streaming: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export const aiChatSchema = z.object({
  conversationId: z.coerce.number().int().positive().nullable().optional(),
  message: z.string().trim().min(2, 'پرسش باید حداقل ۲ نویسه باشد.').max(4000),
});

export const aiUseCaseSchema = z.object({
  feature: z.enum(['chat', 'explain_own_result', 'report_summary']),
  enabled: z.boolean().default(false),
  dataCategories: z
    .array(z.enum(['help_content', 'own_results', 'aggregate_metrics', 'org_structure', 'policy_text']))
    .default([]),
  minRoleKey: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});
