import { supabase } from './supabase';

/** Normalize a KMC number for storage/comparison: trim + uppercase. */
export const normalizeKmc = (value: string): string => value.trim().toUpperCase();

/**
 * Checks whether a KMC (Karnataka Medical Council) number is already registered
 * to a *different* user. The KMC number uniquely identifies a doctor, so the
 * same value must never be claimed by two accounts.
 *
 * Comparison is case-insensitive (`ilike` with no wildcards = exact match).
 * `kmc_number` carries no `%`/`_` characters, so the value is safe to pass as a
 * pattern. Reads rely on the permissive `"Users can read other users basic
 * info"` policy on `users`, so this also works for pending users mid-onboarding.
 *
 * @param kmcNumber     the value the user is trying to save
 * @param excludeUserId the current user's id, so updating your own profile
 *                      without changing the KMC number is not flagged as a dup
 * @returns true if another user already holds this KMC number
 */
export async function isKmcNumberTaken(
  kmcNumber: string,
  excludeUserId?: string
): Promise<boolean> {
  const normalized = normalizeKmc(kmcNumber);
  if (!normalized) return false;

  let query = supabase
    .from('users')
    .select('id')
    .ilike('kmc_number', normalized)
    .limit(1);

  if (excludeUserId) query = query.neq('id', excludeUserId);

  const { data, error } = await query;
  if (error) throw error;

  return (data?.length ?? 0) > 0;
}
