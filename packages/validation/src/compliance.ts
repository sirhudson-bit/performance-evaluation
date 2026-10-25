import { z } from 'zod';
import { email, optionalPhone } from './common.js';

export const settingsSchema = z.record(z.string().max(8000));

/** Business/legal identity. Missing values must stay missing, never invented. */
export const complianceSchema = z.object({
  legalName: z.string().trim().max(200).nullable().optional(),
  registrationNo: z.string().trim().max(80).nullable().optional(),
  nationalId: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(400).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  contactEmail: email.nullable().optional(),
  contactPhone: optionalPhone.nullable(),
  jurisdictions: z.array(z.string().trim().max(80)).default([]),
  targetMarkets: z.array(z.string().trim().max(80)).default([]),
  serviceOfferings: z.string().trim().max(2000).nullable().optional(),
  hasPaidOffering: z.boolean().default(false),
  dataRetention: z.string().trim().max(500).nullable().optional(),
  internationalTransfers: z.string().trim().max(500).nullable().optional(),
  policyVersion: z.string().trim().max(20).default('1.0'),
  reviewedBy: z.string().trim().max(120).nullable().optional(),
});

export const thirdPartyServiceSchema = z.object({
  name: z.string().trim().min(2, 'نام سرویس الزامی است.').max(120),
  provider: z.string().trim().max(120).optional(),
  purpose: z.string().trim().min(2, 'هدف سرویس الزامی است.').max(300),
  category: z.enum(['functional', 'analytics', 'marketing', 'ai', 'email', 'payment', 'cdn', 'other']),
  dataTransmitted: z.string().trim().max(500).optional(),
  requiresConsent: z.boolean().default(false),
  isActive: z.boolean().default(true),
  privacyUrl: z.string().trim().url().max(300).optional().or(z.literal('').transform(() => undefined)),
  notes: z.string().trim().max(1000).optional(),
});

export const helpArticleSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, 'نشانی باید انگلیسی و با خط تیره باشد.'),
  title: z.string().trim().min(2, 'عنوان الزامی است.').max(200),
  summary: z.string().trim().max(500).optional(),
  body: z.string().trim().min(2, 'متن الزامی است.').max(20000),
  roleScope: z.array(z.string().max(60)).default([]),
  module: z.string().trim().max(60).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(['published', 'draft']).default('published'),
});

export const helpFaqSchema = z.object({
  question: z.string().trim().min(3, 'پرسش الزامی است.').max(400),
  answer: z.string().trim().min(2, 'پاسخ الزامی است.').max(4000),
  category: z.string().trim().max(80).optional(),
  roleScope: z.array(z.string().max(60)).default([]),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(['published', 'draft']).default('published'),
});

export const helpGlossarySchema = z.object({
  term: z.string().trim().min(1, 'واژه الزامی است.').max(120),
  definition: z.string().trim().min(2, 'تعریف الزامی است.').max(2000),
  category: z.string().trim().max(80).optional(),
});

export const assetSchema = z.object({
  name: z.string().trim().min(1).max(160),
  kind: z.enum(['font', 'icon', 'image', 'library', 'media']),
  source: z.string().trim().max(300).optional(),
  license: z.string().trim().max(120).optional(),
  attribution: z.string().trim().max(300).optional(),
  commercialUse: z.boolean().default(true),
  usage: z.string().trim().max(300).optional(),
  verified: z.boolean().default(false),
});
