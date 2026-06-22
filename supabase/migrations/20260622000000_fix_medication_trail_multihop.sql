-- Multi-hop medication journey fix (3+ hops / 4+ doctors).
-- Two corrections to get_complete_medication_trail, both of which only misbehave
-- once a chain has 3+ hops (referral d1867b2d / patient Seema surfaced them):
--
--   1. "Received Transfer" used fc.transferred_at as the receipt time. For a
--      MIDDLE referral, transferred_at is when it was transferred AWAY (later),
--      not when its holder received it. The true receipt time is the child's
--      created_at (the instant the transfer created the child for its to_user).
--      Using transferred_at dumped a doctor's "Received" step into a later
--      timestamp cluster, scrambling the journey order. -> use created_at.
--
--   2. Every 'initial' medication_history row is redundant noise: the root's row
--      duplicates the synthetic "Created Referral" event, and each child's row
--      duplicates that hop's "Received Transfer" (and any "Updated During
--      Transfer"). Emitting them produced ~3 near-identical steps per hop. Drop
--      'initial' events so the journey reads cleanly:
--        Created -> (Updated) -> Received -> ... -> Updated -> Received -> Completed
--
-- Net effect for d1867b2d: 9 noisy/misordered steps collapse to 6 correct ones.
-- 2-hop chains are unaffected by #1 (the last/closed node has transferred_at =
-- created_at) and only shed their duplicate 'initial' rows from #2.

CREATE OR REPLACE FUNCTION public.get_complete_medication_trail(p_referral_id uuid)
 RETURNS TABLE(step_number integer, record_timestamp timestamp with time zone, formatted_time text, doctor_name text, doctor_id uuid, action_type text, department_context text, medication_prescribed text, medication_context text, referral_id uuid, referral_title text, is_original_referral boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Authorization guard: an authenticated caller may only read the trail for a
    -- referral they are allowed to see under the normal referrals SELECT policy.
    -- (auth.uid() IS NULL = trusted service-role/admin context → allowed.)
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
    WITH RECURSIVE referral_chain AS (
        SELECT r.id, r.transfer_parent_id, 1 AS level, ARRAY[r.id] AS path_ids
        FROM referrals r WHERE r.id = p_referral_id
        UNION ALL
        SELECT r.id, r.transfer_parent_id, rc.level + 1, rc.path_ids || r.id
        FROM referrals r
        INNER JOIN referral_chain rc ON r.id = rc.transfer_parent_id
        WHERE r.id <> ALL(rc.path_ids)
    ),
    full_chain AS (
        SELECT r.* FROM referrals r
        WHERE r.id IN (SELECT unnest(path_ids) FROM referral_chain)
    ),
    medication_events AS (
        -- Event 1: original referral creation
        SELECT
            fc.id AS referral_id,
            fc.created_at AS event_timestamp,
            fc.from_user_id AS event_user_id,
            'Created Referral' AS event_type,
            fc.initial_medication AS medication_value,
            'Original prescription by ' || COALESCE(fu.full_name, 'Unknown Doctor') AS medication_context,
            fc.title AS referral_title,
            TRUE AS is_original_referral_in_chain,
            COALESCE(fu.department, 'Unknown Department') AS event_department
        FROM full_chain fc
        LEFT JOIN users fu ON fc.from_user_id = fu.id
        WHERE fc.transfer_parent_id IS NULL

        UNION ALL

        -- Event 2: medication history entries.
        -- 'initial' rows are intentionally excluded — they duplicate either the
        -- "Created Referral" event (root) or the hop's "Received Transfer" /
        -- "Updated During Transfer" events (children), and produced redundant steps.
        SELECT
            mh.referral_id,
            mh.updated_at AS event_timestamp,
            mh.updated_by AS event_user_id,
            CASE
                WHEN mh.update_type = 'completion_update' THEN 'Completed Referral'
                WHEN mh.update_type = 'transfer_update' THEN 'Updated During Transfer'
                ELSE 'Manual Update'
            END AS event_type,
            mh.medication_text AS medication_value,
            CASE
                WHEN mh.update_type = 'completion_update' THEN 'Final medication update by ' || COALESCE(u.full_name, 'Unknown User')
                WHEN mh.update_type = 'transfer_update' THEN 'Updated medication during transfer to ' ||
                    COALESCE(
                        (SELECT c.to_department FROM referrals c
                         WHERE c.transfer_parent_id = mh.referral_id
                         ORDER BY c.created_at DESC LIMIT 1),
                        r.to_department,
                        'Unknown Department')
                ELSE 'Manual medication update by ' || COALESCE(u.full_name, 'Unknown User')
            END AS medication_context,
            r.title AS referral_title,
            (r.transfer_parent_id IS NULL) AS is_original_referral_in_chain,
            COALESCE(u.department, r.to_department, 'Unknown Department') AS event_department
        FROM medication_history mh
        JOIN referrals r ON mh.referral_id = r.id
        LEFT JOIN users u ON mh.updated_by = u.id
        WHERE mh.referral_id IN (SELECT id FROM full_chain)
          AND mh.update_type <> 'initial'

        UNION ALL

        -- Event 3: "Received Transfer" events for children.
        -- Receipt time = the child's created_at (the moment the transfer created it
        -- for to_user), NOT transferred_at (which for a middle node is the later
        -- onward-transfer time). Medication shown = the medication actually handed
        -- over = the child's initial medication_history row (fall back to the
        -- initial_medication column if absent).
        SELECT
            fc.id as referral_id,
            fc.created_at as event_timestamp,
            fc.to_user_id as event_user_id,
            'Received Transfer' as event_type,
            COALESCE(
                (SELECT mh3.medication_text FROM medication_history mh3
                 WHERE mh3.referral_id = fc.id AND mh3.update_type = 'initial'
                 ORDER BY mh3.updated_at ASC LIMIT 1),
                fc.initial_medication
            ) as medication_value,
            'Received referral transfer from ' || COALESCE(fc.transferred_from_department, 'Unknown Department') as medication_context,
            fc.title as referral_title,
            FALSE as is_original_referral_in_chain,
            fc.to_department as event_department
        FROM full_chain fc
        WHERE fc.transfer_parent_id IS NOT NULL
    )
    SELECT
        CAST(ROW_NUMBER() OVER (ORDER BY me.event_timestamp ASC,
                          CASE
                            WHEN me.event_type = 'Created Referral' THEN 1
                            WHEN me.event_type = 'Updated During Transfer' THEN 2
                            WHEN me.event_type = 'Received Transfer' THEN 3
                            WHEN me.event_type = 'Completed Referral' THEN 4
                            ELSE 5
                          END) AS INTEGER) AS step_number,
        me.event_timestamp AS record_timestamp,
        TO_CHAR(me.event_timestamp, 'Mon DD, YYYY at HH24:MI') AS formatted_time,
        COALESCE(u.full_name, 'System') AS doctor_name,
        me.event_user_id AS doctor_id,
        me.event_type AS action_type,
        me.event_department AS department_context,
        me.medication_value AS medication_prescribed,
        me.medication_context,
        me.referral_id,
        me.referral_title,
        me.is_original_referral_in_chain
    FROM medication_events me
    LEFT JOIN users u ON me.event_user_id = u.id
    ORDER BY record_timestamp ASC, step_number ASC;
END;
$function$;
