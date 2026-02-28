-- Phase 14: audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL CHECK (action IN (
    'key.created', 'key.deleted',
    'purchase.completed',
    'listing.published',
    'webhook.created', 'webhook.deleted'
  )),
  resource_type TEXT,
  resource_id   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx     ON audit_logs(action);

-- API routeはAdmin client (service_role) で直接書き込むため RLS をバイパスする。
-- anon / authenticated ロールによる全操作を明示的に拒否する。
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON audit_logs FOR ALL USING (false) WITH CHECK (false);
