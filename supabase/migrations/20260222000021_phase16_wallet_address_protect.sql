-- Phase 16: wallet_address 直接更新禁止トリガー
-- ---------------------------------------------------
-- 問題: profiles テーブルの wallet_address は SIWS (consume_wallet_challenge RPC) 経由のみ
--       更新すべきだが、RLS ポリシーの profiles_update は列単位の制御をしていないため、
--       Supabase SDK/REST から authenticated ロールでも wallet_address を直接書き換えられる。
-- 解決: BEFORE UPDATE トリガーで wallet_address の変更を service_role のみに制限する。
--       service_role = Admin クライアント経由 (consume_wallet_challenge RPC の実行ロール)

CREATE OR REPLACE FUNCTION public.prevent_wallet_address_direct_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- wallet_address が変更されようとしている場合
  IF NEW.wallet_address IS DISTINCT FROM OLD.wallet_address THEN
    -- service_role のみ許可 (consume_wallet_challenge RPC が使用するロール)
    IF current_setting('role', TRUE) <> 'service_role' THEN
      RAISE EXCEPTION 'wallet_address can only be updated via the SIWS verification flow'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 既存トリガーがあれば削除してから作成
DROP TRIGGER IF EXISTS trg_prevent_wallet_address_direct_update ON public.profiles;

CREATE TRIGGER trg_prevent_wallet_address_direct_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_wallet_address_direct_update();

COMMENT ON FUNCTION public.prevent_wallet_address_direct_update() IS
  'wallet_address の直接更新を service_role 以外のロールから禁止する。'
  'SIWS フロー (consume_wallet_challenge RPC) のみが wallet_address を更新できる。';
