-- ========================================
-- Security Hardening Migration
-- Codex Review で指摘された脆弱性を修正
-- ========================================

-- ========================================
-- 1. コンテンツ分離テーブル
--    full_content / file_url を購入者のみアクセス可能にする
-- ========================================

CREATE TABLE knowledge_item_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_item_id UUID NOT NULL UNIQUE REFERENCES knowledge_items(id) ON DELETE CASCADE,
  full_content TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 既存データを移行
INSERT INTO knowledge_item_contents (knowledge_item_id, full_content, file_url)
SELECT id, full_content, file_url FROM knowledge_items
WHERE full_content IS NOT NULL OR file_url IS NOT NULL;

-- knowledge_items から full_content / file_url を削除
ALTER TABLE knowledge_items DROP COLUMN full_content;
ALTER TABLE knowledge_items DROP COLUMN file_url;

-- RLS: 売り手 or confirmed 購入者のみ閲覧可能
ALTER TABLE knowledge_item_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contents_select" ON knowledge_item_contents
  FOR SELECT USING (
    -- 売り手自身
    EXISTS (
      SELECT 1 FROM knowledge_items ki
      WHERE ki.id = knowledge_item_id AND ki.seller_id = auth.uid()
    )
    OR
    -- confirmed 購入者
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.knowledge_item_id = knowledge_item_contents.knowledge_item_id
        AND t.buyer_id = auth.uid()
        AND t.status = 'confirmed'
    )
  );

-- 売り手のみ INSERT/UPDATE 可能
CREATE POLICY "contents_insert" ON knowledge_item_contents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_items ki
      WHERE ki.id = knowledge_item_id AND ki.seller_id = auth.uid()
    )
  );

CREATE POLICY "contents_update" ON knowledge_item_contents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM knowledge_items ki
      WHERE ki.id = knowledge_item_id AND ki.seller_id = auth.uid()
    )
  );

CREATE POLICY "contents_delete" ON knowledge_item_contents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM knowledge_items ki
      WHERE ki.id = knowledge_item_id AND ki.seller_id = auth.uid()
    )
  );

CREATE TRIGGER trigger_contents_updated_at
  BEFORE UPDATE ON knowledge_item_contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================
-- 2. transactions RLS 強化
--    クライアントからの直接 INSERT で confirmed を防ぐ
-- ========================================

DROP POLICY "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (
    buyer_id = auth.uid()
    AND status = 'pending'  -- クライアントからは pending のみ
  );

-- UPDATE は不可（サーバー側 RPC でのみ変更）
-- 既存の UPDATE ポリシーがないことを確認

-- ========================================
-- 3. reviews RLS 強化
--    購入済みユーザーのみレビュー可能
-- ========================================

DROP POLICY "reviews_insert" ON reviews;
CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND t.buyer_id = auth.uid()
        AND t.knowledge_item_id = reviews.knowledge_item_id
        AND t.status = 'confirmed'
    )
  );

-- ========================================
-- 4. SECURITY DEFINER RPCs
--    view_count / purchase_count を安全に更新
-- ========================================

CREATE OR REPLACE FUNCTION increment_view_count(item_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_items
  SET view_count = view_count + 1
  WHERE id = item_id AND status = 'published';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_purchase_count(item_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_items
  SET purchase_count = purchase_count + 1
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トランザクションを confirmed に更新する RPC（サーバーのみ使用）
CREATE OR REPLACE FUNCTION confirm_transaction(tx_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE transactions
  SET status = 'confirmed', updated_at = NOW()
  WHERE id = tx_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 平均レーティング更新 RPC
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. 二重購入防止インデックス
-- ========================================

CREATE UNIQUE INDEX idx_transactions_unique_purchase
  ON transactions (buyer_id, knowledge_item_id)
  WHERE status = 'confirmed';

-- tx_hash を NOT NULL にする（pending 時にもハッシュが必要）
ALTER TABLE transactions ALTER COLUMN tx_hash SET NOT NULL;
CREATE UNIQUE INDEX idx_transactions_unique_tx_hash
  ON transactions (tx_hash);

-- 既存の非ユニークインデックスを削除（ユニークに置き換え）
DROP INDEX IF EXISTS idx_api_keys_hash;

-- ========================================
-- 6. file_url のバリデーション制約
-- ========================================

ALTER TABLE knowledge_item_contents
  ADD CONSTRAINT chk_file_url_https
  CHECK (file_url IS NULL OR file_url LIKE 'https://%');
