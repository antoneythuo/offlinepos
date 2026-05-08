// Branch filter utility for multi-branch mode
// Task 33.4 — Requirements 31.1–31.3

/**
 * Returns a Knex `.where()` compatible filter object for branch_id.
 *
 * When `branchId` is provided (multi-branch mode is active and a branch is
 * assigned to the current terminal), the returned object constrains queries
 * to that branch.  When `branchId` is undefined the returned empty object
 * applies no additional filter, preserving single-branch / legacy behaviour.
 *
 * Usage:
 *   qb.where(getBranchFilter(branchId))
 *
 * @param branchId  The current branch ID from the session/settings, or
 *                  undefined when multi-branch mode is disabled.
 */
export function getBranchFilter(branchId?: number): { branch_id: number } | Record<string, never> {
  if (branchId !== undefined) {
    return { branch_id: branchId }
  }
  return {}
}
