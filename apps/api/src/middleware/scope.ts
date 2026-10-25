import { db } from '../db.js';
import { notFound, forbidden } from '../lib/http.js';
import type { AuthUser } from '../types.js';

/**
 * Data-scope authorization.
 *
 * A manager must NOT see every employee merely because they hold the manager
 * role. Visibility is derived from the organizational relationship (self +
 * current reports + manager history) unless the user holds `employees.view_all`
 * or is a platform administrator.
 *
 * Reads of an out-of-scope single record resolve to 404 (never 403), so an
 * unauthorized id never confirms that the record exists.
 */
export interface EmployeeScope {
  organizationId: number | null;
  seesAll: boolean;
  employeeIds: number[];
  ownEmployeeId: number | null;
}

export async function resolveEmployeeScope(auth: AuthUser): Promise<EmployeeScope> {
  const own = await db.employee.findFirst({ where: { userId: auth.id }, select: { id: true } });
  const seesAll = auth.isPlatformAdmin || auth.permissions.includes('employees.view_all');

  if (seesAll) {
    const rows = auth.organizationId
      ? await db.employee.findMany({ where: { organizationId: auth.organizationId }, select: { id: true } })
      : [];
    return {
      organizationId: auth.organizationId,
      seesAll: true,
      employeeIds: rows.map((r) => r.id),
      ownEmployeeId: own?.id ?? null,
    };
  }

  const ids = new Set<number>();
  if (own) {
    ids.add(own.id);
    const reports = await db.employee.findMany({ where: { managerId: own.id }, select: { id: true } });
    for (const r of reports) ids.add(r.id);

    const history = await db.employeeManagerHistory.findMany({
      where: { managerEmployeeId: own.id, effectiveTo: null },
      select: { employeeId: true },
    });
    for (const h of history) ids.add(h.employeeId);
  }

  return {
    organizationId: auth.organizationId,
    seesAll: false,
    employeeIds: [...ids],
    ownEmployeeId: own?.id ?? null,
  };
}

export function canAccessEmployee(scope: EmployeeScope, employeeId: number): boolean {
  return scope.seesAll ? true : scope.employeeIds.includes(employeeId);
}

/** Asserts the employee exists and is visible; throws 404 otherwise. */
export async function assertEmployeeAccess(auth: AuthUser, employeeId: number): Promise<void> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { organizationId: true },
  });
  if (!employee || employee.organizationId !== auth.organizationId) throw notFound();

  const scope = await resolveEmployeeScope(auth);
  if (!canAccessEmployee(scope, employeeId)) throw notFound();
}

/** Resolves the organization id for a request, or throws 403 if none. */
export function requireOrganization(auth: AuthUser): number {
  if (auth.organizationId === null) throw forbidden('حساب کاربری به سازمانی متصل نیست.');
  return auth.organizationId;
}
