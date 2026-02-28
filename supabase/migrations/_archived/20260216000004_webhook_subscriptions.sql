-- ========================================
-- Webhook Subscriptions Table
-- エージェントが購入完了等のイベント通知を受信するための設定
-- ========================================

CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraints
ALTER TABLE webhook_subscriptions
  ADD CONSTRAINT chk_webhook_url_https CHECK (url LIKE 'https://%');

-- Indexes
CREATE INDEX idx_webhook_subs_user ON webhook_subscriptions(user_id);
CREATE INDEX idx_webhook_subs_active ON webhook_subscriptions(active) WHERE active = true;

-- RLS
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_subs_select" ON webhook_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "webhook_subs_insert" ON webhook_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "webhook_subs_update" ON webhook_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "webhook_subs_delete" ON webhook_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER trigger_webhook_subs_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
