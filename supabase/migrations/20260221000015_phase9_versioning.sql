-- Phase 9.2: ナレッジバージョニング

-- 9.2.1: knowledge_item_versions テーブル
CREATE TABLE knowledge_item_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  -- スナップショット
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  preview_content TEXT,
  price_sol DECIMAL(18,9),
  price_usdc DECIMAL(18,6),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB,
  full_content TEXT,
  -- 変更情報
  changed_by UUID NOT NULL REFERENCES profiles(id),
  change_summary TEXT CHECK (char_length(change_summary) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(knowledge_item_id, version_number)
);

-- 9.2.2: インデックス
-- UNIQUE(knowledge_item_id, version_number) が knowledge_item_id 先頭の複合インデックスを自動作成するため
-- 単独インデックスは不要。created_at 降順用インデックスのみ追加。
CREATE INDEX idx_versions_created_at ON knowledge_item_versions(knowledge_item_id, created_at DESC);

-- 9.2.3: RLS 有効化
ALTER TABLE knowledge_item_versions ENABLE ROW LEVEL SECURITY;

-- 売り手は自分のアイテムの全バージョンを読取可
CREATE POLICY "seller_read_own_versions"
  ON knowledge_item_versions
  FOR SELECT
  USING (
    knowledge_item_id IN (
      SELECT id FROM knowledge_items WHERE seller_id = auth.uid()
    )
  );

-- 購入者（confirmed な取引がある）はメタデータ読取可（full_content は列レベルで除外）
CREATE POLICY "buyer_read_version_metadata"
  ON knowledge_item_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.knowledge_item_id = knowledge_item_versions.knowledge_item_id
        AND t.buyer_id = auth.uid()
        AND t.status = 'confirmed'
    )
  );

-- 購入者から full_content 列への直接アクセスを防止
REVOKE ALL ON knowledge_item_versions FROM authenticated;
GRANT SELECT (id, knowledge_item_id, version_number, title, description, preview_content,
  price_sol, price_usdc, tags, metadata, changed_by, change_summary, created_at)
  ON knowledge_item_versions TO authenticated;

-- 9.2.4: バージョンスナップショットを原子的に作成する関数
-- advisory lock + 採番 + INSERT を単一トランザクション内で実行し、競合を防止する。
CREATE OR REPLACE FUNCTION create_version_snapshot(
  p_knowledge_item_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_preview_content TEXT,
  p_price_sol DECIMAL(18,9),
  p_price_usdc DECIMAL(18,6),
  p_tags TEXT[],
  p_metadata JSONB,
  p_full_content TEXT,
  p_changed_by UUID,
  p_change_summary TEXT
)
RETURNS JSON AS $$
DECLARE
  v_next INTEGER;
  v_id UUID;
BEGIN
  -- アイテム単位の advisory lock で同時 PATCH の競合を防止
  PERFORM pg_advisory_xact_lock(hashtext('version_' || p_knowledge_item_id::text));

  -- 採番
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next
    FROM knowledge_item_versions
    WHERE knowledge_item_id = p_knowledge_item_id;

  -- INSERT
  INSERT INTO knowledge_item_versions (
    knowledge_item_id, version_number, title, description,
    preview_content, price_sol, price_usdc, tags, metadata,
    full_content, changed_by, change_summary
  ) VALUES (
    p_knowledge_item_id, v_next, p_title, p_description,
    p_preview_content, p_price_sol, p_price_usdc, p_tags, p_metadata,
    p_full_content, p_changed_by, p_change_summary
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'version_number', v_next);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

REVOKE ALL ON FUNCTION create_version_snapshot(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT[], JSONB, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_version_snapshot(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT[], JSONB, TEXT, UUID, TEXT) TO service_role;
