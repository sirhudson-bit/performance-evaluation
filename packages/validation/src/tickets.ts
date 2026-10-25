import { z } from 'zod';

export const ticketCreateSchema = z.object({
  subject: z.string().trim().min(3, 'موضوع الزامی است.').max(200),
  category: z.enum(['general', 'evaluation', 'technical', 'other']).default('general'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  body: z.string().trim().min(2, 'متن پیام الزامی است.').max(4000),
});

export const ticketReplySchema = z.object({
  body: z.string().trim().min(1, 'متن پیام الزامی است.').max(4000),
});

export const ticketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'answered', 'closed']),
  assignedToId: z.coerce.number().int().positive().nullable().optional(),
});
