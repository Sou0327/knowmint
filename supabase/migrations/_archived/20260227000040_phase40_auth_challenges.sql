-- Phase 40: エージェント自律オンボーディング — auth_challenges テーブル + RPC
-- 既存 wallet_challenges は user_id NOT NULL REFERENCES auth.users(id) のため未登録ユーザーに使えない

-- ── auth_challenges テーブル ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet     TEXT NOT NULL,
  nonce      TEXT NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_challenges_wallet_idx
  ON public.auth_challenges (wallet);
CREATE INDEX IF NOT EXISTS auth_challenges_expires_at_idx
  ON public.auth_challenges (expires_at);

ALTER TABLE public.auth_challenges ENABLE ROW LEVEL SECURITY;
-- RLS policy なし = anon/authenticated deny all, service_role bypass

-- ── consume_auth_challenge RPC ──────────────────────────────────────────────
-- SECURITY DEFINER + service_role 専用。search_path 固定で injection 防止。
CREATE OR REPLACE FUNCTION public.consume_auth_challenge(
  p_wallet text, p_nonce text, p_purpose text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
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
REVOKE ALL ON FUNCTION public.consume_auth_challenge(text,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.consume_auth_challenge(text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_auth_challenge(text,text,text) TO service_role;

-- ── pg_cron: 期限切れ auth_challenges クリーンアップ (毎時) ────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-expired-auth-challenges',
      '0 * * * *',
      $$DELETE FROM public.auth_challenges WHERE expires_at < NOW()$$
    );
  END IF;
END;
$$;
