import { z } from 'zod';
import { email, isoDate, optionalPhone, persianName } from './common.js';

export const unitSchema = z.object({
  name: z.string().trim().min(2, 'نام واحد الزامی است.').max(120),
  code: z.string().trim().max(40).optional().or(z.literal('').transform(() => undefined)),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  type: z.enum(['department', 'subdepartment', 'team', 'division']).default('department'),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(['active', 'archived']).default('active'),
  effectiveFrom: isoDate.optional(),
  effectiveTo: isoDate.optional(),
});

export const positionSchema = z.object({
  title: z.string().trim().min(2, 'عنوان سمت الزامی است.').max(120),
  code: z.string().trim().max(40).optional().or(z.literal('').transform(() => undefined)),
  unitId: z.coerce.number().int().positive().nullable().optional(),
  level: z.string().trim().max(40).optional(),
  status: z.enum(['active', 'archived']).default('active'),
});

export const employeeSchema = z.object({
  employeeNo: z.string().trim().min(1, 'شماره پرسنلی الزامی است.').max(40),
  firstName: persianName,
  lastName: persianName,
  displayName: z.string().trim().max(120).optional(),
  email: email.optional(),
  phone: optionalPhone,
  unitId: z.coerce.number().int().positive().nullable().optional(),
  positionId: z.coerce.number().int().positive().nullable().optional(),
  managerId: z.coerce.number().int().positive().nullable().optional(),
  hireDate: isoDate.optional(),
  status: z.enum(['active', 'inactive', 'terminated', 'archived']).default('active'),
});

export const managerHistorySchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  managerEmployeeId: z.coerce.number().int().positive().nullable(),
  unitId: z.coerce.number().int().positive().nullable().optional(),
  positionId: z.coerce.number().int().positive().nullable().optional(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.optional(),
  reason: z.string().trim().max(300).optional(),
});

/** Excel import confirmation payload (after preview). */
export const employeeImportConfirmSchema = z.object({
  rows: z
    .array(
      z.object({
        employeeNo: z.string().trim().min(1).max(40),
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        email: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)),
        unitCode: z.string().trim().max(40).optional(),
        positionCode: z.string().trim().max(40).optional(),
        managerEmployeeNo: z.string().trim().max(40).optional(),
      }),
    )
    .min(1, 'هیچ ردیفی برای ثبت وجود ندارد.'),
});
