-- SEC-1: Block agent users from publishing knowledge items at the DB level
-- Enforces the same rule as the application layer (publish route + Server Action)
-- to prevent direct Supabase API bypass via direct Supabase API calls.
--
-- Implementation: trigger (not RLS WITH CHECK) so only the draft→published
-- transition is blocked, preserving editability of any legacy agent rows.

CREATE OR REPLACE FUNCTION enforce_sec1_no_agent_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Only block the transition TO 'published' (INSERT or UPDATE)
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status <> 'published')
  THEN
    -- Use NEW.seller_id (not auth.uid()) so the check is invariant
    -- regardless of whether the write comes from a session or service-role client.
    IF EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = NEW.seller_id
        AND p.user_type = 'agent'::profile_user_type
    ) THEN
      RAISE EXCEPTION 'Agents cannot publish knowledge items'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Revoke public/authenticated execute (SECURITY DEFINER handles auth internally)
REVOKE ALL ON FUNCTION enforce_sec1_no_agent_publish() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_sec1_no_agent_publish() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sec1_no_agent_publish ON knowledge_items;
CREATE TRIGGER trg_sec1_no_agent_publish
  BEFORE INSERT OR UPDATE ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION enforce_sec1_no_agent_publish();
