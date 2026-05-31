import { useQuery } from '@tanstack/react-query';
import { getContext } from '@microsoft/power-apps/app';

/** Subset of the Power Apps host's user context we need for UI display. */
export interface CurrentUser {
  fullName?: string;
  objectId?: string;
  userPrincipalName?: string;
}

/**
 * Currently signed-in user as reported by the Power Apps host context.
 *
 * Cached at the app-session level via React Query — the user can't change
 * mid-session so `staleTime: Infinity` keeps this from refetching. Used as
 * the display fallback when a record's `owneridname` annotation hasn't
 * propagated yet (e.g. on a freshly-created row that still mirrors the
 * optimistic POST response).
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    staleTime: Infinity,
    queryFn: async (): Promise<CurrentUser> => {
      const ctx = await getContext();
      return {
        fullName: ctx.user.fullName,
        objectId: ctx.user.objectId,
        userPrincipalName: ctx.user.userPrincipalName,
      };
    },
  });
}
