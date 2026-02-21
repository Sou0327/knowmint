-- Phase 9.1: 売り手信頼スコア

-- 9.1.1: trust_score カラム追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trust_score DECIMAL(3,2) DEFAULT 0.0
  CHECK (trust_score >= 0.0 AND trust_score <= 1.0);

-- 9.1.2: recalculate_trust_score 関数
--
-- スコア計算式:
--   usefulness_avg  x 0.35  ... seller の全アイテムへの useful フィードバック平均
--   rating_norm     x 0.30  ... reviews テーブルの平均 rating / 5.0
--   sales_norm      x 0.20  ... min(確定取引数 / 100, 1.0)
--   follower_norm   x 0.15  ... min(follower_count / 50, 1.0)
--
CREATE OR REPLACE FUNCTION recalculate_trust_score(seller_id UUID)
RETURNS VOID AS $$
DECLARE
  v_usefulness_avg  DECIMAL(10,6);
  v_rating_norm     DECIMAL(10,6);
  v_sales_norm      DECIMAL(10,6);
  v_follower_norm   DECIMAL(10,6);
  v_follower_count  INTEGER;
  v_trust_score     DECIMAL(3,2);
BEGIN
  -- usefulness_avg: seller の全公開アイテムに対するフィードバックの useful 比率
  SELECT COALESCE(
    AVG(CASE WHEN kf.useful THEN 1.0 ELSE 0.0 END),
    0.0
  )
  INTO v_usefulness_avg
  FROM knowledge_feedbacks kf
  JOIN knowledge_items ki ON ki.id = kf.knowledge_item_id
  WHERE ki.seller_id = recalculate_trust_score.seller_id;

  -- rating_norm: 平均レビュー評価 / 5.0
  SELECT COALESCE(AVG(r.rating) / 5.0, 0.0)
  INTO v_rating_norm
  FROM reviews r
  JOIN knowledge_items ki ON ki.id = r.knowledge_item_id
  WHERE ki.seller_id = recalculate_trust_score.seller_id;

  -- sales_norm: 確定取引数 / 100 (最大 1.0)
  SELECT LEAST(COALESCE(COUNT(*), 0) / 100.0, 1.0)
  INTO v_sales_norm
  FROM transactions t
  WHERE t.seller_id = recalculate_trust_score.seller_id
    AND t.status = 'confirmed';

  -- follower_norm: follower_count / 50 (最大 1.0)
  SELECT COALESCE(follower_count, 0)
  INTO v_follower_count
  FROM profiles
  WHERE id = recalculate_trust_score.seller_id;

  v_follower_norm := LEAST(v_follower_count / 50.0, 1.0);

  -- 加重平均でスコア算出 (0.00 〜 1.00)
  v_trust_score := ROUND(
    (v_usefulness_avg * 0.35
     + v_rating_norm  * 0.30
     + v_sales_norm   * 0.20
     + v_follower_norm * 0.15)::NUMERIC,
    2
  );

  -- profiles に書き戻す
  UPDATE profiles
  SET trust_score = v_trust_score
  WHERE id = recalculate_trust_score.seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- SECURITY DEFINER 関数の EXECUTE 権限を制限し、service_role のみに付与
REVOKE ALL ON FUNCTION recalculate_trust_score(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recalculate_trust_score(UUID) TO service_role;

-- 9.1.3: トリガー関数 — knowledge_feedbacks 用
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id UUID;
  v_old_seller_id UUID;
  v_item_id UUID;
BEGIN
  -- INSERT/UPDATE は NEW、DELETE は OLD を使う
  v_item_id := CASE TG_OP WHEN 'DELETE' THEN OLD.knowledge_item_id ELSE NEW.knowledge_item_id END;

  SELECT seller_id INTO v_seller_id
  FROM knowledge_items
  WHERE id = v_item_id;

  IF v_seller_id IS NOT NULL THEN
    PERFORM recalculate_trust_score(v_seller_id);
  END IF;

  -- UPDATE で knowledge_item_id が変わった場合、旧アイテムの売り手も再計算
  IF TG_OP = 'UPDATE' AND OLD.knowledge_item_id IS DISTINCT FROM NEW.knowledge_item_id THEN
    SELECT seller_id INTO v_old_seller_id
    FROM knowledge_items
    WHERE id = OLD.knowledge_item_id;

    IF v_old_seller_id IS NOT NULL AND v_old_seller_id IS DISTINCT FROM v_seller_id THEN
      PERFORM recalculate_trust_score(v_old_seller_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

DROP TRIGGER IF EXISTS trg_trust_score_on_feedback ON knowledge_feedbacks;
CREATE TRIGGER trg_trust_score_on_feedback
AFTER INSERT OR UPDATE OR DELETE ON knowledge_feedbacks
FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_feedback();

-- 9.1.4: トリガー関数 — follows 用
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_follow()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id UUID;
BEGIN
  -- INSERT では NEW、DELETE では OLD を使用
  v_seller_id := CASE TG_OP WHEN 'DELETE' THEN OLD.following_id ELSE NEW.following_id END;

  IF v_seller_id IS NOT NULL THEN
    PERFORM recalculate_trust_score(v_seller_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

DROP TRIGGER IF EXISTS trg_trust_score_on_follow ON follows;
CREATE TRIGGER trg_trust_score_on_follow
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_follow();

-- 9.1.5: トリガー関数 — reviews 用
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_review()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id UUID;
  v_old_seller_id UUID;
  v_item_id UUID;
BEGIN
  -- INSERT/UPDATE は NEW、DELETE は OLD を使う
  v_item_id := CASE TG_OP WHEN 'DELETE' THEN OLD.knowledge_item_id ELSE NEW.knowledge_item_id END;

  SELECT seller_id INTO v_seller_id
  FROM knowledge_items
  WHERE id = v_item_id;

  IF v_seller_id IS NOT NULL THEN
    PERFORM recalculate_trust_score(v_seller_id);
  END IF;

  -- UPDATE で knowledge_item_id が変わった場合、旧アイテムの売り手も再計算
  IF TG_OP = 'UPDATE' AND OLD.knowledge_item_id IS DISTINCT FROM NEW.knowledge_item_id THEN
    SELECT seller_id INTO v_old_seller_id
    FROM knowledge_items
    WHERE id = OLD.knowledge_item_id;

    IF v_old_seller_id IS NOT NULL AND v_old_seller_id IS DISTINCT FROM v_seller_id THEN
      PERFORM recalculate_trust_score(v_old_seller_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

DROP TRIGGER IF EXISTS trg_trust_score_on_review ON reviews;
CREATE TRIGGER trg_trust_score_on_review
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_review();

-- 9.1.6: トリガー関数 — transactions 用 (sales_norm の再計算)
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id UUID;
  v_old_seller_id UUID;
BEGIN
  -- sales_norm は confirmed のみ参照するため、confirmed に関係ない変更はスキップ
  IF TG_OP = 'INSERT' AND NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status <> 'confirmed' THEN
    RETURN OLD;
  END IF;
  -- UPDATE: 旧新とも confirmed でなければ sales_norm は不変なのでスキップ
  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'confirmed'
     AND NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  v_seller_id := CASE TG_OP WHEN 'DELETE' THEN OLD.seller_id ELSE NEW.seller_id END;

  IF v_seller_id IS NOT NULL THEN
    PERFORM recalculate_trust_score(v_seller_id);
  END IF;

  -- UPDATE で seller_id が変わった場合、旧 seller も再計算
  IF TG_OP = 'UPDATE' AND OLD.seller_id IS DISTINCT FROM NEW.seller_id THEN
    v_old_seller_id := OLD.seller_id;
    IF v_old_seller_id IS NOT NULL THEN
      PERFORM recalculate_trust_score(v_old_seller_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- INSERT/DELETE: confirmed 状態のみ関数内でガード
DROP TRIGGER IF EXISTS trg_trust_score_on_transaction ON transactions;
CREATE TRIGGER trg_trust_score_on_transaction
AFTER INSERT OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_transaction();

-- UPDATE: status または seller_id が変わった場合のみ発火
DROP TRIGGER IF EXISTS trg_trust_score_on_transaction_update ON transactions;
CREATE TRIGGER trg_trust_score_on_transaction_update
AFTER UPDATE ON transactions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.seller_id IS DISTINCT FROM NEW.seller_id)
EXECUTE FUNCTION trg_recalculate_trust_score_on_transaction();

-- 9.1.7: トリガー関数 — knowledge_items 削除/seller_id 変更用
-- CASCADE で feedbacks/reviews が消えた後、元の seller_id が参照不能になる問題を防止
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.seller_id IS DISTINCT FROM NEW.seller_id) THEN
    PERFORM recalculate_trust_score(OLD.seller_id);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.seller_id IS DISTINCT FROM NEW.seller_id THEN
    PERFORM recalculate_trust_score(NEW.seller_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

DROP TRIGGER IF EXISTS trg_trust_score_on_item_change ON knowledge_items;
CREATE TRIGGER trg_trust_score_on_item_change
AFTER DELETE OR UPDATE OF seller_id ON knowledge_items
FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_item_change();

-- 9.1.8: transactions 部分インデックス (trust_score 再計算高速化)
CREATE INDEX IF NOT EXISTS idx_transactions_seller_confirmed
  ON transactions(seller_id) WHERE status = 'confirmed';

-- 9.1.9: 既存データの一括再計算
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT seller_id FROM knowledge_items LOOP
    PERFORM recalculate_trust_score(r.seller_id);
  END LOOP;
END;
$$;
