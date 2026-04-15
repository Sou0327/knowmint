-- RP6 (B-8): Extend audit_logs action CHECK constraint with wallet verification events.
--
-- Adds three new actions emitted from /api/v1/me/wallet/verify:
--   - wallet.verified          success after consume_wallet_challenge
--   - wallet.conflict_attempt  caller tried to register a wallet claimed by another user
--   - wallet.profile_missing   challenge consumed but profiles row was missing (data integrity bug)
--
-- Non-destructive: existing rows keep their actions; only the allowed set grows.
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
  'admin.listing_suspended', 'admin.apikey_revoked',
  'wallet.verified', 'wallet.conflict_attempt', 'wallet.profile_missing'
));
