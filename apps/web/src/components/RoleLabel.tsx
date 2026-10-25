import { EVALUATOR_ROLES, type EvaluatorRole } from '@pe/shared/enums';

/** Renders an evaluator-role value as its Persian label. */
export function RoleLabel({ role }: { role: string }) {
  return <span>{(EVALUATOR_ROLES as Record<string, string>)[role] ?? (role as EvaluatorRole)}</span>;
}
