-- Hotfix: auth_challenges table was included in squashed schema but never
-- applied to production DB (original migration was archived before push).

-- 1. Table
CREATE TABLE IF NOT EXISTS auth_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet     TEXT NOT NULL,
  nonce      TEXT NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS auth_challenges_wallet_idx
  ON auth_challenges(wallet);
CREATE INDEX IF NOT EXISTS auth_challenges_expires_at_idx
  ON auth_challenges(expires_at);

-- 3. RLS (service_role bypass, anon/authenticated deny all)
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;

-- 4. consume_auth_challenge RPC
CREATE OR REPLACE FUNCTION public.consume_auth_challenge(
  p_wallet text, p_nonce text, p_purpose text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_wallet text;
BEGIN
  DELETE FROM public.auth_challenges
  WHERE wallet = p_wallet AND nonce = p_nonce
    AND purpose = p_purpose AND expires_at > pg_catalog.now()
  RETURNING wallet INTO v_wallet;

  IF v_wallet IS NULL THEN RETURN 'not_found'; END IF;
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_challenge(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_auth_challenge(text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_auth_challenge(text,text,text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_auth_challenge(text,text,text) TO service_role;

-- 5. Cron cleanup (hourly, idempotent)
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-expired-auth-challenges',
      '0 * * * *',
      $cron$DELETE FROM public.auth_challenges WHERE expires_at < NOW()$cron$
    );
  END IF;
END $do$;
