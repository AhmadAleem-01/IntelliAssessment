import { useQuery } from '@tanstack/react-query';
import { getContext } from '@microsoft/power-apps/app';
import { SystemusersService } from '../generated/services/SystemusersService';
import { RolesService } from '../generated/services/RolesService';

/**
 * Role-based action gating (M9).
 *
 * The Power Apps host context exposes the signed-in user's Entra `objectId`
 * but NOT their Dataverse security roles, and the SDK has no `$expand`. So we
 * read roles in two filtered queries:
 *   1. `systemusers` filtered by `azureactivedirectoryobjectid = objectId`
 *      → the caller's `systemuserid`.
 *   2. `roles` filtered on the `systemuserroles_association` membership for that
 *      `systemuserid` → the caller's role `name`s.
 *
 * (The `systemuserrole` intersect table can't be added as a data source in
 * this environment, hence the association-`any()` filter instead of a join.)
 *
 * Matching is by role NAME — see `ROLE_NAMES`. This is UI-level gating: it
 * hides actions the caller can't perform. Real enforcement still comes from the
 * Dataverse table privileges granted to each security role.
 */

/** Exact Dataverse security-role names we gate against. */
export const ROLE_NAMES = {
  assessor: 'Assessor',
  reviewer: 'Reviewer',
  admin: 'Admin',
} as const;

export interface UserRoles {
  /** All role names the user holds (raw, for debugging / future use). */
  names: string[];
  isAssessor: boolean;
  isReviewer: boolean;
  isAdmin: boolean;
}

async function fetchCurrentUserRoles(): Promise<UserRoles> {
  const empty: UserRoles = { names: [], isAssessor: false, isReviewer: false, isAdmin: false };

  const ctx = await getContext();
  const objectId = ctx.user.objectId;
  if (!objectId) return empty;

  // 1. objectId → systemuserid.
  const userRes = await SystemusersService.getAll({
    filter: `azureactivedirectoryobjectid eq ${objectId}`,
    select: ['systemuserid'],
    top: 1,
  });
  const systemuserid = userRes.success ? userRes.data?.[0]?.systemuserid : undefined;
  if (!systemuserid) return empty;

  // 2. systemuserid → role names, via the association membership filter.
  const rolesRes = await RolesService.getAll({
    filter: `systemuserroles_association/any(u:u/systemuserid eq ${systemuserid})`,
    select: ['name'],
    top: 200,
  });
  if (!rolesRes.success) return empty;

  const names = (rolesRes.data ?? [])
    .map((r) => (r.name ?? '').trim())
    .filter(Boolean);
  const has = (n: string) => names.some((x) => x.toLowerCase() === n.toLowerCase());

  return {
    names,
    isAssessor: has(ROLE_NAMES.assessor),
    isReviewer: has(ROLE_NAMES.reviewer),
    // Only the explicit 'Admin' role grants app-admin — the built-in
    // System Administrator is kept independent by design.
    isAdmin: has(ROLE_NAMES.admin),
  };
}

/**
 * The signed-in user's app roles. Cached for the session (roles don't change
 * mid-session). While loading, everything is `false` — callers should treat
 * `isLoading` as "don't show role-gated actions yet" to avoid a flash of
 * buttons that then vanish.
 */
export function useCurrentUserRoles() {
  const query = useQuery({
    queryKey: ['currentUserRoles'],
    staleTime: Infinity,
    queryFn: fetchCurrentUserRoles,
  });
  const roles = query.data ?? { names: [], isAssessor: false, isReviewer: false, isAdmin: false };
  return {
    ...roles,
    isLoading: query.isLoading,
    // Admin implicitly holds every capability.
    canAssess: roles.isAssessor || roles.isAdmin,
    canReview: roles.isReviewer || roles.isAdmin,
    canAdmin: roles.isAdmin,
  };
}

/**
 * A short label of the user's APP roles for display (e.g. the topbar) — only
 * the three we recognise, in a stable order, joined by ' · '. Ignores the many
 * built-in Dataverse roles the user also holds. Empty string when none.
 */
export function appRoleLabel(roles: {
  isAdmin: boolean;
  isReviewer: boolean;
  isAssessor: boolean;
}): string {
  const parts: string[] = [];
  if (roles.isAdmin) parts.push('Admin');
  if (roles.isReviewer) parts.push('Reviewer');
  if (roles.isAssessor) parts.push('Assessor');
  return parts.join(' · ');
}
