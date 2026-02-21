-- Phase 7: ナレッジメタデータ強化 & フィードバック品質シグナル

-- 7.1.1: metadata JSONB カラム追加
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 7.2.2: usefulness_score カラム追加
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS usefulness_score DECIMAL(3,2) DEFAULT 0.0
  CHECK (usefulness_score >= 0.0 AND usefulness_score <= 1.0);

-- 7.1: metadata JSONB 検索用インデックス (#3 Performance)
CREATE INDEX IF NOT EXISTS idx_knowledge_items_metadata_domain
  ON knowledge_items ((metadata->>'domain'))
  WHERE metadata->>'domain' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_items_metadata_experience_type
  ON knowledge_items ((metadata->>'experience_type'))
  WHERE metadata->>'experience_type' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_items_metadata_source_type
  ON knowledge_items ((metadata->>'source_type'))
  WHERE metadata->>'source_type' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_items_metadata_gin
  ON knowledge_items USING GIN (metadata jsonb_path_ops);

-- 7.2.1: フィードバックテーブル
CREATE TABLE IF NOT EXISTS knowledge_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  useful BOOLEAN NOT NULL,
  usage_context TEXT CHECK (char_length(usage_context) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(transaction_id)  -- 1トランザクション=1フィードバック
);

-- フィードバック集計用インデックス (#4 Performance)
CREATE INDEX IF NOT EXISTS idx_knowledge_feedbacks_item_id
  ON knowledge_feedbacks (knowledge_item_id);

-- RLS
ALTER TABLE knowledge_feedbacks ENABLE ROW LEVEL SECURITY;

-- #1 Critical: RLS で transaction_id/knowledge_item_id の整合性も検証
CREATE POLICY "buyers can insert own feedbacks" ON knowledge_feedbacks
  FOR INSERT WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_id
        AND transactions.buyer_id = auth.uid()
        AND transactions.knowledge_item_id = knowledge_feedbacks.knowledge_item_id
        AND transactions.status = 'confirmed'
    )
  );

CREATE POLICY "sellers can read feedbacks on their items" ON knowledge_feedbacks
  FOR SELECT USING (
    knowledge_item_id IN (SELECT id FROM knowledge_items WHERE seller_id = auth.uid())
  );

-- usefulness_score 自動更新トリガー
CREATE OR REPLACE FUNCTION update_usefulness_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE knowledge_items
  SET usefulness_score = (
    SELECT COALESCE(AVG(CASE WHEN useful THEN 1.0 ELSE 0.0 END), 0.0)
    FROM knowledge_feedbacks
    WHERE knowledge_item_id = NEW.knowledge_item_id
  )
  WHERE id = NEW.knowledge_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usefulness_score
AFTER INSERT OR UPDATE ON knowledge_feedbacks
FOR EACH ROW EXECUTE FUNCTION update_usefulness_score();
