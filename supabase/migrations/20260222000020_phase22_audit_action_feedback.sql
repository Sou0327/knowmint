-- Phase 22: audit_logs の action CHECK 制約に feedback.created を追加
-- Phase 14 で feedback.created が漏れていたため ALTER で再定義する
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'key.created', 'key.deleted',
  'purchase.completed',
  'feedback.created',
  'listing.published',
  'webhook.created', 'webhook.deleted'
));
