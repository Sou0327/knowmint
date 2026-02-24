-- Phase 17: Webhook DLQ (dead letter queue) テーブル
-- webhook_subscriptions への論理参照のみ (FK なし — 削除後も記録保持)

CREATE TABLE public.webhook_delivery_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  event           TEXT NOT NULL,
  attempt         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'failed'
    CONSTRAINT dlq_status_check CHECK (status IN ('failed', 'dead')),
  status_code     INTEGER,
  error_message   TEXT,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX webhook_delivery_logs_sub_idx
  ON public.webhook_delivery_logs (subscription_id, created_at DESC);

ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- webhook subscription owner のみ SELECT 可
CREATE POLICY "owners_select" ON public.webhook_delivery_logs FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM public.webhook_subscriptions WHERE user_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.webhook_delivery_logs FROM PUBLIC, authenticated;
GRANT  INSERT, UPDATE, DELETE ON public.webhook_delivery_logs TO service_role;
