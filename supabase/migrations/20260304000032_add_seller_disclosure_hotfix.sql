-- Hotfix: seller_disclosure column was included in squashed schema but never
-- applied to production DB (original migration was archived before push).
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS seller_disclosure TEXT
    CONSTRAINT seller_disclosure_length
      CHECK (seller_disclosure IS NULL OR char_length(seller_disclosure) <= 500);

COMMENT ON COLUMN knowledge_items.seller_disclosure
  IS '特商法に基づく販売者情報（任意入力、出品者が自身の情報を任意開示）';
