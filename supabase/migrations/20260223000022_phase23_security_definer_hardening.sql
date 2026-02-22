-- ========================================
-- Phase 23: SECURITY DEFINER 関数のハードニング
-- Black/White Hacker 双子エージェント診断 (2026-02-23) で発見した脆弱性を修正
--
-- 対象:
--   1. SECURITY DEFINER 関数に SET search_path = pg_catalog, public を追加
--      (search_path ハイジャック防止)
--   2. increment_view_count / increment_purchase_count / update_average_rating の
--      PUBLIC/authenticated 実行権限を REVOKE し service_role のみに制限
--      (カウント操作防止)
-- ========================================

-- ========================================
-- 1. increment_view_count: search_path 設定 + 権限制限
-- ========================================
CREATE OR REPLACE FUNCTION increment_view_count(item_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_items
  SET view_count = view_count + 1
  WHERE id = item_id AND status = 'published';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO service_role;

-- ========================================
-- 2. increment_purchase_count: search_path 設定 + 権限制限
-- ========================================
CREATE OR REPLACE FUNCTION increment_purchase_count(item_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_items
  SET purchase_count = purchase_count + 1
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.increment_purchase_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_purchase_count(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_purchase_count(uuid) TO service_role;

-- ========================================
-- 3. confirm_transaction: search_path 設定 (REVOKE は Phase 21 適用済み)
-- ========================================
CREATE OR REPLACE FUNCTION confirm_transaction(tx_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE transactions
  SET status = 'confirmed', updated_at = NOW()
  WHERE id = tx_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public;

-- Phase 21 で REVOKE 済みだが念のため再適用
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_transaction(uuid) TO service_role;

-- ========================================
-- 4. update_average_rating: search_path 設定 + 権限制限
-- ========================================
CREATE OR REPLACE FUNCTION update_average_rating(item_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_items
  SET average_rating = (
    SELECT AVG(rating)::DECIMAL(3,2)
    FROM reviews
    WHERE knowledge_item_id = item_id
  )
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.update_average_rating(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_average_rating(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_average_rating(uuid) TO service_role;

-- ========================================
-- 5. handle_new_user: search_path 設定
--    (PUBLIC 実行権限は TRIGGER として auth スキーマから呼ばれるため変更不要)
-- ========================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public;
