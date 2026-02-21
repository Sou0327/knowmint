-- Phase 10: Security Fixes (2026-02-21)

-- 10.1: api_keys permissions ホワイトリスト制約
-- NOT VALID: 既存データを検証せず新規行のみに適用 (既存不正データによる失敗を防ぐ)
-- 既存データクレンジング後に VALIDATE CONSTRAINT chk_api_keys_permissions; を実行すること
ALTER TABLE api_keys
  ADD CONSTRAINT chk_api_keys_permissions
  CHECK (permissions <@ ARRAY['read','write','admin']::text[]) NOT VALID;

-- 10.2: knowledge_item_contents full_content サイズ制限 (500,000文字以下)
-- NOT VALID: 既存超過データによる失敗を防ぐ
-- 既存データクレンジング後に VALIDATE CONSTRAINT chk_full_content_length; を実行すること
ALTER TABLE knowledge_item_contents
  ADD CONSTRAINT chk_full_content_length
  CHECK (full_content IS NULL OR char_length(full_content) <= 500000) NOT VALID;

-- 10.3: webhook_subscriptions シークレットをハッシュ化
ALTER TABLE webhook_subscriptions
  ADD COLUMN secret_hash TEXT;

-- 既存シークレットを無効化: 平文を削除し、再登録を促すため active = false にする
UPDATE webhook_subscriptions
  SET secret = 'REVOKED', active = false
  WHERE secret IS NOT NULL AND secret != 'REVOKED';

-- secret 列の NOT NULL 制約を解除 (新規INSERTは secret_hash のみ保存)
ALTER TABLE webhook_subscriptions
  ALTER COLUMN secret DROP NOT NULL;

-- active=true のレコードは必ず正しい形式の secret_hash を持つことを保証
-- NULL は UNKNOWN になり CHECK をすり抜けるため IS NOT NULL を明示する
ALTER TABLE webhook_subscriptions
  ADD CONSTRAINT chk_secret_hash_format
  CHECK (NOT active OR (secret_hash IS NOT NULL AND secret_hash ~ '^[0-9a-f]{64}$'));

-- 平文シークレットの再保存を禁止 (新規レコードは secret=NULL のみ許可)
ALTER TABLE webhook_subscriptions
  ADD CONSTRAINT chk_secret_revoked
  CHECK (secret IS NULL OR secret = 'REVOKED');
