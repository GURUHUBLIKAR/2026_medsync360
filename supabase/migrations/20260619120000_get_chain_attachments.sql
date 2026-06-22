-- Chain-wide attachments: a downstream doctor must see every file attached at any
-- hop of the referral journey (labs, scans, ECGs), exactly like the medication
-- journey. RLS on referral_attachments (3 policies) would otherwise truncate
-- upstream rows for a downstream doctor, so this RPC is SECURITY DEFINER with the
-- same auth guard + pinned search_path as get_complete_medication_trail.
-- See memory: chain-walking-rpcs-need-security-definer.

CREATE OR REPLACE FUNCTION public.get_chain_attachments(p_referral_id uuid)
RETURNS TABLE(
  id uuid,
  file_name text,
  file_type text,
  file_size integer,
  file_url text,
  uploaded_by uuid,
  uploader_name text,
  created_at timestamptz,
  referral_id uuid,
  referral_department text,
  hop_level integer,
  is_current_referral boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Authorization guard: an authenticated caller may only read attachments for a
  -- referral they are allowed to see under the normal referrals SELECT policy.
  -- (auth.uid() IS NULL = trusted service-role/admin context -> allowed.)
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM referrals r
    WHERE r.id = p_referral_id
      AND (
        r.from_user_id = auth.uid()
        OR r.to_user_id = auth.uid()
        OR r.to_department IN (SELECT u.department FROM users u WHERE u.id = auth.uid())
      )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE up AS (
    -- Walk UP from the opened referral to the chain root (cycle-guarded).
    SELECT r.id, r.transfer_parent_id, ARRAY[r.id] AS path
    FROM referrals r WHERE r.id = p_referral_id
    UNION ALL
    SELECT r.id, r.transfer_parent_id, up.path || r.id
    FROM referrals r
    INNER JOIN up ON r.id = up.transfer_parent_id
    WHERE r.id <> ALL(up.path)
  ),
  root AS (
    SELECT up.id FROM up WHERE up.transfer_parent_id IS NULL LIMIT 1
  ),
  chain AS (
    -- Walk DOWN from the root collecting hop levels (0 = origin), cycle-guarded.
    -- Entry-point independent: same set regardless of which node was opened.
    SELECT r.id, r.transfer_parent_id, 0 AS hop_level, r.to_department, ARRAY[r.id] AS path
    FROM referrals r WHERE r.id = (SELECT root.id FROM root)
    UNION ALL
    SELECT r.id, r.transfer_parent_id, c.hop_level + 1, r.to_department, c.path || r.id
    FROM referrals r
    INNER JOIN chain c ON r.transfer_parent_id = c.id
    WHERE r.id <> ALL(c.path)
  )
  SELECT
    ra.id,
    ra.file_name,
    ra.file_type,
    ra.file_size,
    ra.file_url,
    ra.uploaded_by,
    u.full_name AS uploader_name,
    ra.created_at,
    ra.referral_id,
    c.to_department AS referral_department,
    c.hop_level,
    (ra.referral_id = p_referral_id) AS is_current_referral
  FROM referral_attachments ra
  INNER JOIN chain c ON ra.referral_id = c.id
  LEFT JOIN users u ON ra.uploaded_by = u.id
  ORDER BY c.hop_level ASC, ra.created_at ASC;
END;
$function$;
