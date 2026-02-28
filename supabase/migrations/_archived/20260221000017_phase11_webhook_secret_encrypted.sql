-- Phase 11: Webhook secret_encrypted column for AES-GCM signing key storage
ALTER TABLE webhook_subscriptions
  ADD COLUMN IF NOT EXISTS secret_encrypted TEXT;
