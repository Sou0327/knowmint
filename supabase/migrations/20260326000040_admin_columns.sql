-- Phase ADMIN: Add admin and ban columns to profiles
ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN banned_at timestamptz DEFAULT null;

-- Initial admin assignment is environment-specific.
-- Run manually after migration: UPDATE profiles SET is_admin = true WHERE id = '<your-auth-user-id>';

-- Partial index for admin queries (very few admins)
CREATE INDEX idx_profiles_is_admin ON profiles (id) WHERE is_admin = true;

-- Extend audit_logs action CHECK constraint with admin operations
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'key.created', 'key.deleted',
  'purchase.completed',
  'feedback.created',
  'listing.published',
  'webhook.created', 'webhook.deleted',
  'report.created', 'report.reviewed',
  'agent.registered', 'agent.login',
  'admin.user_banned', 'admin.user_unbanned',
  'admin.listing_suspended', 'admin.apikey_revoked'
));

-- SQL-aggregated revenue by token (avoids loading all transactions into JS)
CREATE OR REPLACE FUNCTION public.get_revenue_by_token()
RETURNS TABLE(token text, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT t.token::text, COALESCE(SUM(t.amount), 0) AS total
  FROM public.transactions t
  WHERE t.status = 'confirmed'
  GROUP BY t.token;
$$;

REVOKE ALL ON FUNCTION public.get_revenue_by_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_revenue_by_token() TO service_role;
