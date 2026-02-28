-- Phase 41: audit_logs_action_check 制約を拡張 (report/agent アクション追加)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (
  action IN (
    'key.created', 'key.deleted',
    'purchase.completed',
    'feedback.created',
    'listing.published',
    'webhook.created', 'webhook.deleted',
    'report.created', 'report.reviewed',
    'agent.registered', 'agent.login'
  )
);
