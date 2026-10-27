import { z } from 'zod';
import { email, password, persianName, optionalPhone } from './common.js';

export const userCreateSchema = z.object({
  name: persianName,
  email,
  phone: optionalPhone,
  password: password.optional(),
  roleIds: z.array(z.coerce.number().int().positive()).default([]),
  status: z.enum(['active', 'suspended', 'archived']).default('active'),
  linkEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
});

export const userUpdateSchema = z.object({
  name: persianName.optional(),
  email: email.optional(),
  phone: optionalPhone,
  roleIds: z.array(z.coerce.number().int().positive()).optional(),
  status: z.enum(['active', 'suspended', 'archived']).optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
});

/**
 * Set a user's password directly. Deliberately separate from `userUpdateSchema`
 * so an ordinary profile edit can never change a credential, and gated on the
 * server to the platform super administrator.
 */
export const userSetPasswordSchema = z.object({
  password,
});

/**
 * A role is composed of permissions. Only names present in the catalog are
 * accepted, so a crafted request cannot invent a permission.
 */
export const roleSchema = z.object({
  name: z.string().trim().min(2, 'نام نقش الزامی است.').max(80),
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'شناسه نقش فقط می‌تواند شامل حروف کوچک، رقم و زیرخط باشد.'),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string().min(1)).default([]),
});

export const assignRolesSchema = z.object({
  roleIds: z.array(z.coerce.number().int().positive()),
});
