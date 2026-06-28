-- Enforce that a KMC (Karnataka Medical Council) number is claimed by at most
-- one account. The app already checks for duplicates before saving
-- (src/lib/kmc.ts, used by onboarding + Settings), but that client check has a
-- race window between two concurrent submissions. This unique index is the
-- authoritative backstop.
--
-- Matching the client's normalizeKmc() (trim + uppercase), uniqueness is
-- enforced case-insensitively and ignoring surrounding whitespace. The KMC
-- number is optional, so NULL / blank values are excluded from the constraint
-- (a partial index) and may repeat freely.
--
-- NOTE: if real duplicates already exist this CREATE will fail. Resolve them
-- first, e.g.:
--   SELECT upper(btrim(kmc_number)) AS kmc, count(*), array_agg(id)
--   FROM users WHERE btrim(coalesce(kmc_number,'')) <> ''
--   GROUP BY 1 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_kmc_number_unique_idx
  ON public.users (upper(btrim(kmc_number)))
  WHERE kmc_number IS NOT NULL AND btrim(kmc_number) <> '';
