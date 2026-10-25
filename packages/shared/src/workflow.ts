/**
 * Workflow state machines.
 *
 * Every permitted transition is validated against these maps on the backend, so
 * an invalid transition sent directly to the API is rejected rather than
 * silently accepted. The UI mirrors these rules but is never the authority.
 */

export type AssignmentStatus =
  | 'draft'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'returned_for_revision'
  | 'approved'
  | 'published'
  | 'reopened'
  | 'appealed'
  | 'cancelled';

export const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  draft: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['submitted', 'cancelled'],
  submitted: ['under_review', 'returned_for_revision', 'approved', 'cancelled'],
  under_review: ['approved', 'returned_for_revision', 'cancelled'],
  returned_for_revision: ['in_progress', 'submitted', 'cancelled'],
  approved: ['published', 'reopened', 'cancelled'],
  published: ['reopened', 'appealed'],
  reopened: ['in_progress', 'submitted', 'under_review', 'approved', 'cancelled'],
  appealed: ['under_review', 'reopened', 'approved'],
  cancelled: [],
};

export type CycleStatus = 'draft' | 'active' | 'in_review' | 'published' | 'closed' | 'cancelled';

export const CYCLE_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['in_review', 'published', 'closed', 'cancelled'],
  in_review: ['active', 'published', 'closed', 'cancelled'],
  published: ['in_review', 'closed'],
  closed: [],
  cancelled: [],
};

export function canTransition<S extends string>(
  map: Record<S, S[]>,
  from: S,
  to: S,
): boolean {
  if (from === to) return false;
  return (map[from] ?? []).includes(to);
}

export function assertTransition<S extends string>(
  map: Record<S, S[]>,
  from: S,
  to: S,
  label = 'وضعیت',
): void {
  if (!canTransition(map, from, to)) {
    throw new Error(`گذار نامعتبر ${label}: از «${from}» به «${to}» مجاز نیست.`);
  }
}

/** Statuses in which an assignment is considered finalized (no further edits). */
export const LOCKED_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'published',
  'appealed',
  'cancelled',
];
