import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/client';

/** Shared query key for the current-session query — reused by the router
 * guard (`ensureQueryData`) and by mutations that need to invalidate it
 * (sign-in success, sign-out). */
export const authQueryKey = ['auth', 'me'] as const;

/** Resolves the signed-in user (or `null`) without ever throwing on the
 * expected "not signed in" 401 — see `getMe` in `../api/client`. */
export function useAuth() {
  return useQuery({ queryKey: authQueryKey, queryFn: getMe, retry: false });
}
