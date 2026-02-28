-- Phase 21: セキュリティ修正
-- 21.1 confirm_transaction RPC の実行権限を service_role のみに制限
-- 21.2 profiles.wallet_address に UNIQUE 制約を追加
-- 21.3 SIWS wallet_challenges テーブル + atomic RPC

-- ─────────────────────────────────────────────
-- 21.1: confirm_transaction の GRANT 制限 [critical]
-- SECURITY DEFINER であっても PUBLIC に EXECUTE が開放されているため
-- 認証済みユーザーが任意の tx_id を confirmed にできてしまう。
-- [Fix-3] REVOKE ALL ですべての権限を一括剥奪（将来追加された権限も漏れなく剥奪）
-- [Fix-6] スキーマ修飾 public. を追加して search_path 依存を排除
-- ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_transaction(uuid) TO service_role;

-- ─────────────────────────────────────────────
-- 21.2: profiles.wallet_address UNIQUE 制約 [high]
-- 同一ウォレットを複数ユーザーが設定するのを防ぐ。
-- NULL は UNIQUE 制約から除外される（Postgres 標準動作）。
--
-- [Fix-1] LOCK TABLE と ALTER TABLE を同一 DO ブロック内で実行し原子化。
-- [Fix-2] DISTINCT ON の ORDER BY に id DESC を追加して tie-break を決定論的に。
-- [Fix-5][Fix-7] 楽観的ロック戦略:
--   1. まずノーロックで ADD CONSTRAINT を試みる（重複なし環境ではこれで完了）
--   2. 失敗（重複あり）した場合のみ ACCESS EXCLUSIVE LOCK を取得し重複解消 → 再試行
--   これにより重複なし環境での可用性影響を最小化しつつ、race condition も回避する。
-- ─────────────────────────────────────────────
DO $$
BEGIN
  -- まず制約が既に存在するか確認（冪等性）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name        = 'profiles'
      AND constraint_name   = 'profiles_wallet_address_unique'
  ) THEN
    -- 楽観的アプローチ: ノーロックで ADD CONSTRAINT を試みる
    BEGIN
      EXECUTE 'ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_wallet_address_unique UNIQUE (wallet_address)';
    EXCEPTION WHEN unique_violation THEN
      -- unique_violation (SQLSTATE 23505) のみを捕捉: 重複が存在することが確定。
      -- 権限エラー・ロックタイムアウト・DDL競合等は伝播させてデプロイを明示的に失敗させる。
      -- 注意: 重複ありの場合はメンテナンス時間帯での実行を推奨。
      LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;

      -- 同一 wallet_address の中で最も新しく更新されたレコードのみ残し、他は NULL にする
      -- updated_at が同値の場合は id DESC で決定論的に 1 行を選択する [Fix-2]
      UPDATE public.profiles
      SET    wallet_address = NULL
      WHERE  id NOT IN (
        SELECT DISTINCT ON (wallet_address) id
        FROM   public.profiles
        WHERE  wallet_address IS NOT NULL
        ORDER  BY wallet_address, updated_at DESC NULLS LAST, id DESC
      )
      AND wallet_address IS NOT NULL;

      -- 重複解消後に再試行（ロック保持中なので競合なし）
      EXECUTE 'ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_wallet_address_unique UNIQUE (wallet_address)';
    END;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────
-- 21.3: wallet_challenges テーブル — SIWS ノンス管理
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nonce      TEXT NOT NULL,
  wallet     TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- expires_at インデックス: 将来の定期クリーンアップジョブ用
-- （例: DELETE FROM wallet_challenges WHERE expires_at < now()）
-- consume_wallet_challenge RPC は user_id UNIQUE インデックス経由で 1 行特定するため
-- このインデックスは consume 時には使われない。クリーンアップ実装まで削除してもよいが、
-- 追加コストが低いため将来の保守性を考慮して維持する。
CREATE INDEX IF NOT EXISTS wallet_challenges_expires_at_idx ON public.wallet_challenges (expires_at);

-- 1ユーザー1チャレンジ — user_id のみを UNIQUE にして別ウォレットで連打しても肥大化しない
-- [Fix-4] user_id UNIQUE 制約により、consume_wallet_challenge RPC の
--         DELETE ... RETURNING は必ず 0 または 1 行しか返さない。
--         複数行 RETURNING によるデータ競合の懸念はこの制約で解消されている。
CREATE UNIQUE INDEX IF NOT EXISTS wallet_challenges_user_idx ON public.wallet_challenges (user_id);

-- RLS: ユーザーは自分のチャレンジのみ参照可（実際の検証はservice_role APIで行う）
ALTER TABLE public.wallet_challenges ENABLE ROW LEVEL SECURITY;

-- 冪等性: ポリシーが既に存在する場合はスキップ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'wallet_challenges'
      AND policyname = 'Users can view own challenges'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own challenges"
      ON public.wallet_challenges FOR SELECT
      USING (auth.uid() = user_id)';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────
-- 21.3: consume_wallet_challenge RPC
-- challenge 消費 + profile 更新を1トランザクション内で原子的に実行する。
-- p_challenge_id を除去し、user_id + wallet + nonce で一意特定
-- → アプリ側の SELECT + RPC 2往復が RPC 1回に削減される。
--
-- 戻り値:
--   'ok'             — 成功
--   'not_found'      — challenge が存在しない/期限切れ/既に消費済み
--   'conflict_wallet'— wallet_address が別ユーザーに既に登録済み (UNIQUE 違反)
--   'user_not_found' — profiles に対象ユーザーが存在しない
-- ─────────────────────────────────────────────
-- [Fix-6] スキーマ修飾 public. を明示
CREATE OR REPLACE FUNCTION public.consume_wallet_challenge(
  p_nonce    text,
  p_user_id  uuid,
  p_wallet   text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
-- pg_catalog を先に解決してシャドーイングを防ぐ
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_wallet text;
BEGIN
  -- Atomically consume the challenge.
  -- user_id + wallet + nonce をキーにすることで、アプリ層での事前 SELECT が不要。
  -- RETURNING wallet を使い、DB 値のみを UPDATE に使う（引数の p_wallet を信頼しない）。
  -- wallet_challenges_user_idx (user_id UNIQUE) により DELETE は 0 or 1 行のみ [Fix-4]
  DELETE FROM public.wallet_challenges
  WHERE user_id   = p_user_id
    AND wallet    = p_wallet
    AND nonce     = p_nonce
    AND expires_at > pg_catalog.now()
  RETURNING wallet INTO v_wallet;

  IF v_wallet IS NULL THEN
    RETURN 'not_found';
  END IF;

  -- Update wallet_address within the same transaction (atomic with DELETE above)
  BEGIN
    UPDATE public.profiles SET wallet_address = v_wallet WHERE id = p_user_id;
    IF NOT FOUND THEN
      RETURN 'user_not_found';
    END IF;
  EXCEPTION WHEN unique_violation THEN
    -- wallet already claimed by another user; challenge is consumed (by design)
    RETURN 'conflict_wallet';
  END;

  RETURN 'ok';
END;
$$;

-- Only service_role may call this function
-- [Fix-3][Fix-6] REVOKE ALL + スキーマ修飾で確実に権限を剥奪
REVOKE ALL ON FUNCTION public.consume_wallet_challenge(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_wallet_challenge(text, uuid, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_wallet_challenge(text, uuid, text) TO service_role;
