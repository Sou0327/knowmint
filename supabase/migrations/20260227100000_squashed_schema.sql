-- ========================================================================
-- KnowMint — Squashed Schema (Phase 46)
-- Consolidates 29 migrations into a single canonical definition.
-- All objects are defined in their FINAL form with proper search_path
-- and REVOKE/GRANT chains applied inline.
-- ========================================================================

-- ========================================================================
-- 1. Extensions
-- ========================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- pg_cron may not be available in all environments
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_cron";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not available — cron jobs will be skipped';
END $$;

-- ========================================================================
-- 2. Enums
-- ========================================================================
CREATE TYPE content_type       AS ENUM ('prompt', 'tool_def', 'dataset', 'api', 'general');
CREATE TYPE knowledge_status   AS ENUM ('draft', 'published', 'archived', 'suspended');
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');
CREATE TYPE chain_type         AS ENUM ('solana', 'base', 'ethereum');
CREATE TYPE token_type         AS ENUM ('SOL', 'USDC', 'ETH');
CREATE TYPE profile_user_type  AS ENUM ('human', 'agent');
CREATE TYPE listing_type       AS ENUM ('offer', 'request');

-- ========================================================================
-- 3. Tables (dependency order)
-- ========================================================================

-- 3.1 profiles
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT,
  avatar_url      TEXT,
  wallet_address  TEXT UNIQUE,
  bio             TEXT,
  user_type       profile_user_type NOT NULL DEFAULT 'human',
  follower_count  INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  trust_score     DECIMAL(3,2) DEFAULT 0.0
    CHECK (trust_score >= 0.0 AND trust_score <= 1.0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 categories
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  parent_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  icon       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 knowledge_items
CREATE TABLE knowledge_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  content_type      content_type NOT NULL DEFAULT 'general',
  price_sol         DECIMAL(18, 9),
  price_usdc        DECIMAL(18, 6),
  preview_content   TEXT,
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  tags              TEXT[] DEFAULT '{}',
  status            knowledge_status NOT NULL DEFAULT 'draft',
  view_count        INTEGER NOT NULL DEFAULT 0,
  purchase_count    INTEGER NOT NULL DEFAULT 0,
  average_rating    DECIMAL(3, 2),
  search_vector     TSVECTOR,
  listing_type      listing_type NOT NULL DEFAULT 'offer',
  metadata          JSONB DEFAULT '{}'::jsonb,
  usefulness_score  DECIMAL(3,2) DEFAULT 0.0
    CHECK (usefulness_score >= 0.0 AND usefulness_score <= 1.0),
  moderation_status TEXT NOT NULL DEFAULT 'none'
    CONSTRAINT mod_status_check CHECK (moderation_status IN ('none', 'under_review', 'removed')),
  seller_disclosure TEXT
    CONSTRAINT seller_disclosure_length CHECK (seller_disclosure IS NULL OR char_length(seller_disclosure) <= 500),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 knowledge_item_contents (separated from knowledge_items for security)
CREATE TABLE knowledge_item_contents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_item_id UUID NOT NULL UNIQUE REFERENCES knowledge_items(id) ON DELETE CASCADE,
  full_content      TEXT,
  file_url          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_file_url_https    CHECK (file_url IS NULL OR file_url LIKE 'https://%'),
  CONSTRAINT chk_full_content_length CHECK (full_content IS NULL OR char_length(full_content) <= 500000)
);

-- 3.5 transactions
CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  amount            DECIMAL(18, 9) NOT NULL,
  token             token_type NOT NULL DEFAULT 'SOL',
  chain             chain_type NOT NULL DEFAULT 'solana',
  tx_hash           TEXT NOT NULL,
  status            transaction_status NOT NULL DEFAULT 'pending',
  protocol_fee      DECIMAL(18, 9) DEFAULT 0,
  fee_vault_address TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_tx_hash_format CHECK (
    (chain = 'solana' AND tx_hash ~ '^[A-Za-z0-9]{87,88}$')
    OR (chain IN ('base', 'ethereum') AND tx_hash ~ '^0x[a-fA-F0-9]{64}$')
  )
);

-- 3.6 reviews
CREATE TABLE reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id    UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  rating            INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 api_keys
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key_hash    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  permissions TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  CONSTRAINT chk_api_keys_permissions CHECK (permissions <@ ARRAY['read','write','admin']::text[])
);

-- 3.8 webhook_subscriptions
CREATE TABLE webhook_subscriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  events           TEXT[] NOT NULL DEFAULT '{}',
  secret           TEXT,
  secret_hash      TEXT,
  secret_encrypted TEXT,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_webhook_url_https  CHECK (url LIKE 'https://%'),
  CONSTRAINT chk_secret_hash_format CHECK (NOT active OR (secret_hash IS NOT NULL AND secret_hash ~ '^[0-9a-f]{64}$')),
  CONSTRAINT chk_secret_revoked     CHECK (secret IS NULL OR secret = 'REVOKED')
);

-- 3.9 favorites
CREATE TABLE favorites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, knowledge_item_id)
);

-- 3.10 follows
CREATE TABLE follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- 3.11 notifications
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('purchase', 'review', 'follow', 'new_listing')),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT false,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.12 knowledge_feedbacks
CREATE TABLE knowledge_feedbacks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  buyer_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id    UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  useful            BOOLEAN NOT NULL,
  usage_context     TEXT CHECK (char_length(usage_context) <= 500),
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(transaction_id)
);

-- 3.13 knowledge_item_versions
CREATE TABLE knowledge_item_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  preview_content   TEXT,
  price_sol         DECIMAL(18,9),
  price_usdc        DECIMAL(18,6),
  tags              TEXT[] DEFAULT '{}',
  metadata          JSONB,
  full_content      TEXT,
  changed_by        UUID NOT NULL REFERENCES profiles(id),
  change_summary    TEXT CHECK (char_length(change_summary) <= 500),
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(knowledge_item_id, version_number)
);

-- 3.14 audit_logs
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL CHECK (action IN (
    'key.created', 'key.deleted',
    'purchase.completed',
    'feedback.created',
    'listing.published',
    'webhook.created', 'webhook.deleted',
    'report.created', 'report.reviewed',
    'agent.registered', 'agent.login'
  )),
  resource_type TEXT,
  resource_id   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.15 wallet_challenges (SIWS nonce management)
CREATE TABLE wallet_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nonce      TEXT NOT NULL,
  wallet     TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.16 webhook_delivery_logs (DLQ — no FK to webhook_subscriptions by design)
CREATE TABLE webhook_delivery_logs (
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

-- 3.17 knowledge_item_reports (moderation)
CREATE TABLE knowledge_item_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  reporter_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason            TEXT NOT NULL
    CONSTRAINT reason_check CHECK (reason IN ('spam', 'illegal', 'misleading', 'inappropriate', 'copyright', 'other')),
  description       TEXT CONSTRAINT desc_len CHECK (char_length(description) <= 1000),
  status            TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT status_check CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewer_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note     TEXT CONSTRAINT note_len CHECK (char_length(reviewer_note) <= 1000),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reports_unique_per_user UNIQUE (knowledge_item_id, reporter_id)
);

-- 3.18 auth_challenges (agent autonomous onboarding)
CREATE TABLE auth_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet     TEXT NOT NULL,
  nonce      TEXT NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================================
-- 4. Indexes
-- ========================================================================

-- knowledge_items
CREATE INDEX idx_knowledge_items_seller         ON knowledge_items(seller_id);
CREATE INDEX idx_knowledge_items_status         ON knowledge_items(status);
CREATE INDEX idx_knowledge_items_category       ON knowledge_items(category_id);
CREATE INDEX idx_knowledge_items_content_type   ON knowledge_items(content_type);
CREATE INDEX idx_knowledge_items_created_at     ON knowledge_items(created_at DESC);
CREATE INDEX idx_knowledge_items_tags           ON knowledge_items USING GIN(tags);
CREATE INDEX idx_knowledge_items_search         ON knowledge_items USING GIN(search_vector);
CREATE INDEX idx_knowledge_items_listing_type   ON knowledge_items(listing_type);
CREATE INDEX idx_knowledge_items_metadata_domain
  ON knowledge_items ((metadata->>'domain')) WHERE metadata->>'domain' IS NOT NULL;
CREATE INDEX idx_knowledge_items_metadata_experience_type
  ON knowledge_items ((metadata->>'experience_type')) WHERE metadata->>'experience_type' IS NOT NULL;
CREATE INDEX idx_knowledge_items_metadata_source_type
  ON knowledge_items ((metadata->>'source_type')) WHERE metadata->>'source_type' IS NOT NULL;
CREATE INDEX idx_knowledge_items_metadata_gin
  ON knowledge_items USING GIN (metadata jsonb_path_ops);

-- transactions
CREATE INDEX idx_transactions_buyer     ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller    ON transactions(seller_id);
CREATE INDEX idx_transactions_knowledge ON transactions(knowledge_item_id);
CREATE INDEX idx_transactions_status    ON transactions(status);
CREATE UNIQUE INDEX idx_transactions_unique_purchase
  ON transactions (buyer_id, knowledge_item_id) WHERE status = 'confirmed';
CREATE UNIQUE INDEX idx_transactions_unique_tx_hash
  ON transactions (chain, tx_hash);
CREATE INDEX idx_transactions_seller_confirmed
  ON transactions(seller_id) WHERE status = 'confirmed';

-- reviews
CREATE INDEX idx_reviews_knowledge ON reviews(knowledge_item_id);
CREATE INDEX idx_reviews_reviewer  ON reviews(reviewer_id);

-- api_keys
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- webhook_subscriptions
CREATE INDEX idx_webhook_subs_user   ON webhook_subscriptions(user_id);
CREATE INDEX idx_webhook_subs_active ON webhook_subscriptions(active) WHERE active = true;

-- favorites (UNIQUE(user_id, knowledge_item_id) covers user_id prefix lookups)
CREATE INDEX idx_favorites_item ON favorites(knowledge_item_id);

-- follows (UNIQUE(follower_id, following_id) covers follower_id prefix lookups)
CREATE INDEX idx_follows_following ON follows(following_id);

-- notifications
CREATE INDEX idx_notifications_user_unread  ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- knowledge_feedbacks
CREATE INDEX idx_knowledge_feedbacks_item_id ON knowledge_feedbacks(knowledge_item_id);

-- knowledge_item_versions
CREATE INDEX idx_versions_created_at ON knowledge_item_versions(knowledge_item_id, created_at DESC);

-- audit_logs
CREATE INDEX audit_logs_user_id_idx    ON audit_logs(user_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX audit_logs_action_idx     ON audit_logs(action);

-- wallet_challenges
CREATE INDEX  wallet_challenges_expires_at_idx ON wallet_challenges(expires_at);
CREATE UNIQUE INDEX wallet_challenges_user_idx ON wallet_challenges(user_id);

-- webhook_delivery_logs
CREATE INDEX webhook_delivery_logs_sub_idx
  ON webhook_delivery_logs(subscription_id, created_at DESC);

-- knowledge_item_reports
CREATE INDEX reports_item_status_idx   ON knowledge_item_reports(knowledge_item_id, status);
CREATE INDEX reports_status_created_idx ON knowledge_item_reports(status, created_at DESC);

-- auth_challenges
CREATE UNIQUE INDEX auth_challenges_wallet_idx     ON auth_challenges(wallet);
CREATE INDEX        auth_challenges_expires_at_idx ON auth_challenges(expires_at);

-- ========================================================================
-- 5. Functions / RPCs (all final versions with SET search_path + REVOKE)
-- ========================================================================

-- 5.1 update_search_vector (full-text search trigger)
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

-- 5.2 update_updated_at (generic timestamp trigger)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5.3 handle_new_user (auto-create profile on signup)
-- FIX: Migration 022 dropped user_type handling; restored from 011 + search_path from 022
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  raw_user_type TEXT;
BEGIN
  raw_user_type := NEW.raw_user_meta_data->>'user_type';

  INSERT INTO public.profiles (id, display_name, user_type)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name',
    CASE
      WHEN raw_user_type = 'agent' THEN 'agent'::public.profile_user_type
      ELSE 'human'::public.profile_user_type
    END
  );

  RETURN NEW;
END;
$$;

-- 5.4 increment_view_count
CREATE OR REPLACE FUNCTION increment_view_count(item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE knowledge_items
  SET view_count = view_count + 1
  WHERE id = item_id AND status = 'published';
END;
$$;

REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_view_count(uuid) TO service_role;

-- 5.5 increment_purchase_count
CREATE OR REPLACE FUNCTION increment_purchase_count(item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE knowledge_items
  SET purchase_count = purchase_count + 1
  WHERE id = item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_purchase_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_purchase_count(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.increment_purchase_count(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_purchase_count(uuid) TO service_role;

-- 5.6 confirm_transaction
CREATE OR REPLACE FUNCTION confirm_transaction(tx_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE transactions
  SET status = 'confirmed', updated_at = NOW()
  WHERE id = tx_id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_transaction(uuid) TO service_role;

-- 5.7 update_average_rating
CREATE OR REPLACE FUNCTION update_average_rating(item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE knowledge_items
  SET average_rating = (
    SELECT AVG(rating)::DECIMAL(3,2)
    FROM reviews
    WHERE knowledge_item_id = item_id
  )
  WHERE id = item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_average_rating(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_average_rating(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.update_average_rating(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.update_average_rating(uuid) TO service_role;

-- 5.8 update_follow_counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = follower_count - 1 WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5.9 create_notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id  UUID,
  p_type     TEXT,
  p_title    TEXT,
  p_message  TEXT,
  p_link     TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) TO service_role;

-- 5.10 update_usefulness_score (trigger function)
CREATE OR REPLACE FUNCTION update_usefulness_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE knowledge_items
  SET usefulness_score = (
    SELECT COALESCE(AVG(CASE WHEN useful THEN 1.0 ELSE 0.0 END), 0.0)
    FROM knowledge_feedbacks
    WHERE knowledge_item_id = NEW.knowledge_item_id
  )
  WHERE id = NEW.knowledge_item_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_usefulness_score() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_usefulness_score() FROM anon;
REVOKE ALL ON FUNCTION public.update_usefulness_score() FROM authenticated;

-- 5.11 recalculate_trust_score
CREATE OR REPLACE FUNCTION recalculate_trust_score(seller_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_usefulness_avg  DECIMAL(10,6);
  v_rating_norm     DECIMAL(10,6);
  v_sales_norm      DECIMAL(10,6);
  v_follower_norm   DECIMAL(10,6);
  v_follower_count  INTEGER;
  v_trust_score     DECIMAL(3,2);
BEGIN
  SELECT COALESCE(AVG(CASE WHEN kf.useful THEN 1.0 ELSE 0.0 END), 0.0)
  INTO v_usefulness_avg
  FROM knowledge_feedbacks kf
  JOIN knowledge_items ki ON ki.id = kf.knowledge_item_id
  WHERE ki.seller_id = recalculate_trust_score.seller_id;

  SELECT COALESCE(AVG(r.rating) / 5.0, 0.0)
  INTO v_rating_norm
  FROM reviews r
  JOIN knowledge_items ki ON ki.id = r.knowledge_item_id
  WHERE ki.seller_id = recalculate_trust_score.seller_id;

  SELECT LEAST(COALESCE(COUNT(*), 0) / 100.0, 1.0)
  INTO v_sales_norm
  FROM transactions t
  WHERE t.seller_id = recalculate_trust_score.seller_id
    AND t.status = 'confirmed';

  SELECT COALESCE(follower_count, 0)
  INTO v_follower_count
  FROM profiles
  WHERE id = recalculate_trust_score.seller_id;

  v_follower_norm := LEAST(v_follower_count / 50.0, 1.0);

  v_trust_score := ROUND(
    (v_usefulness_avg * 0.35
     + v_rating_norm  * 0.30
     + v_sales_norm   * 0.20
     + v_follower_norm * 0.15)::NUMERIC,
    2
  );

  UPDATE profiles
  SET trust_score = v_trust_score
  WHERE id = recalculate_trust_score.seller_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_trust_score(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_trust_score(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recalculate_trust_score(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.recalculate_trust_score(uuid) TO service_role;

-- 5.12 trg_recalculate_trust_score_on_feedback
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_seller_id     UUID;
  v_old_seller_id UUID;
  v_item_id       UUID;
BEGIN
  v_item_id := CASE TG_OP WHEN 'DELETE' THEN OLD.knowledge_item_id ELSE NEW.knowledge_item_id END;

  SELECT seller_id INTO v_seller_id
  FROM knowledge_items WHERE id = v_item_id;

  IF v_seller_id IS NOT NULL THEN
    PERFORM recalculate_trust_score(v_seller_id);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.knowledge_item_id IS DISTINCT FROM NEW.knowledge_item_id THEN
    SELECT seller_id INTO v_old_seller_id
    FROM knowledge_items WHERE id = OLD.knowledge_item_id;

    IF v_old_seller_id IS NOT NULL AND v_old_seller_id IS DISTINCT FROM v_seller_id THEN
      PERFORM recalculate_trust_score(v_old_seller_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_feedback() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_feedback() FROM anon;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_feedback() FROM authenticated;

-- 5.13 trg_recalculate_trust_score_on_follow
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_seller_id UUID;
BEGIN
  v_seller_id := CASE TG_OP WHEN 'DELETE' THEN OLD.following_id ELSE NEW.following_id END;

  IF v_seller_id IS NOT NULL THEN
    PERFORM recalculate_trust_score(v_seller_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_follow() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_follow() FROM anon;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_follow() FROM authenticated;

-- 5.14 trg_recalculate_trust_score_on_review
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_seller_id     UUID;
  v_old_seller_id UUID;
  v_item_id       UUID;
BEGIN
  v_item_id := CASE TG_OP WHEN 'DELETE' THEN OLD.knowledge_item_id ELSE NEW.knowledge_item_id END;

  SELECT seller_id INTO v_seller_id
  FROM knowledge_items WHERE id = v_item_id;

  IF v_seller_id IS NOT NULL THEN
    PERFORM recalculate_trust_score(v_seller_id);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.knowledge_item_id IS DISTINCT FROM NEW.knowledge_item_id THEN
    SELECT seller_id INTO v_old_seller_id
    FROM knowledge_items WHERE id = OLD.knowledge_item_id;

    IF v_old_seller_id IS NOT NULL AND v_old_seller_id IS DISTINCT FROM v_seller_id THEN
      PERFORM recalculate_trust_score(v_old_seller_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_review() FROM anon;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_review() FROM authenticated;

-- 5.15 trg_recalculate_trust_score_on_transaction
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_seller_id     UUID;
  v_old_seller_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status <> 'confirmed' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'confirmed'
     AND NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  v_seller_id := CASE TG_OP WHEN 'DELETE' THEN OLD.seller_id ELSE NEW.seller_id END;

  IF v_seller_id IS NOT NULL THEN
    PERFORM recalculate_trust_score(v_seller_id);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.seller_id IS DISTINCT FROM NEW.seller_id THEN
    v_old_seller_id := OLD.seller_id;
    IF v_old_seller_id IS NOT NULL THEN
      PERFORM recalculate_trust_score(v_old_seller_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_transaction() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_transaction() FROM anon;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_transaction() FROM authenticated;

-- 5.16 trg_recalculate_trust_score_on_item_change
CREATE OR REPLACE FUNCTION trg_recalculate_trust_score_on_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.seller_id IS DISTINCT FROM NEW.seller_id) THEN
    PERFORM recalculate_trust_score(OLD.seller_id);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.seller_id IS DISTINCT FROM NEW.seller_id THEN
    PERFORM recalculate_trust_score(NEW.seller_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_item_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_item_change() FROM anon;
REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_item_change() FROM authenticated;

-- 5.17 create_version_snapshot
CREATE OR REPLACE FUNCTION create_version_snapshot(
  p_knowledge_item_id UUID,
  p_title             TEXT,
  p_description       TEXT,
  p_preview_content   TEXT,
  p_price_sol         DECIMAL(18,9),
  p_price_usdc        DECIMAL(18,6),
  p_tags              TEXT[],
  p_metadata          JSONB,
  p_full_content      TEXT,
  p_changed_by        UUID,
  p_change_summary    TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_next INTEGER;
  v_id   UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('version_' || p_knowledge_item_id::text));

  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next
    FROM knowledge_item_versions
    WHERE knowledge_item_id = p_knowledge_item_id;

  INSERT INTO knowledge_item_versions (
    knowledge_item_id, version_number, title, description,
    preview_content, price_sol, price_usdc, tags, metadata,
    full_content, changed_by, change_summary
  ) VALUES (
    p_knowledge_item_id, v_next, p_title, p_description,
    p_preview_content, p_price_sol, p_price_usdc, p_tags, p_metadata,
    p_full_content, p_changed_by, p_change_summary
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'version_number', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.create_version_snapshot(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT[], JSONB, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_version_snapshot(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT[], JSONB, TEXT, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_version_snapshot(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT[], JSONB, TEXT, UUID, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.create_version_snapshot(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT[], JSONB, TEXT, UUID, TEXT) TO service_role;

-- 5.18 consume_wallet_challenge
CREATE OR REPLACE FUNCTION public.consume_wallet_challenge(
  p_nonce   text,
  p_user_id uuid,
  p_wallet  text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_wallet text;
BEGIN
  DELETE FROM public.wallet_challenges
  WHERE user_id   = p_user_id
    AND wallet    = p_wallet
    AND nonce     = p_nonce
    AND expires_at > pg_catalog.now()
  RETURNING wallet INTO v_wallet;

  IF v_wallet IS NULL THEN
    RETURN 'not_found';
  END IF;

  BEGIN
    UPDATE public.profiles SET wallet_address = v_wallet WHERE id = p_user_id;
    IF NOT FOUND THEN
      RETURN 'user_not_found';
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RETURN 'conflict_wallet';
  END;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.consume_wallet_challenge(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_wallet_challenge(text, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_wallet_challenge(text, uuid, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_wallet_challenge(text, uuid, text) TO service_role;

-- 5.19 prevent_wallet_address_direct_update
CREATE OR REPLACE FUNCTION public.prevent_wallet_address_direct_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.wallet_address IS DISTINCT FROM OLD.wallet_address THEN
    IF current_setting('role', TRUE) <> 'service_role' THEN
      RAISE EXCEPTION 'wallet_address can only be updated via the SIWS verification flow'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5.20 maybe_flag_for_review
CREATE OR REPLACE FUNCTION public.maybe_flag_for_review(p_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.knowledge_item_reports
    WHERE knowledge_item_id = p_item_id AND status = 'pending'
  ) >= 5
  AND (
    SELECT moderation_status FROM public.knowledge_items WHERE id = p_item_id
  ) = 'none'
  THEN
    UPDATE public.knowledge_items
    SET moderation_status = 'under_review'
    WHERE id = p_item_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_flag_for_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.maybe_flag_for_review(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.maybe_flag_for_review(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.maybe_flag_for_review(uuid) TO service_role;

-- 5.21 admin_review_report
CREATE OR REPLACE FUNCTION public.admin_review_report(
  p_report_id    UUID,
  p_new_status   TEXT,
  p_reviewer_id  UUID,
  p_reviewer_note TEXT,
  p_remove_item  BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_knowledge_item_id UUID;
BEGIN
  IF p_new_status NOT IN ('pending', 'reviewing', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status value: %', p_new_status;
  END IF;

  SELECT knowledge_item_id INTO v_knowledge_item_id
  FROM public.knowledge_item_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found: %', p_report_id;
  END IF;

  IF p_remove_item AND p_new_status = 'resolved' THEN
    UPDATE public.knowledge_items
    SET status = 'draft', moderation_status = 'removed'
    WHERE id = v_knowledge_item_id;
  END IF;

  UPDATE public.knowledge_item_reports
  SET
    status        = p_new_status,
    reviewer_id   = p_reviewer_id,
    reviewer_note = p_reviewer_note,
    reviewed_at   = NOW()
  WHERE id = p_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_report(uuid, text, uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_report(uuid, text, uuid, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.admin_review_report(uuid, text, uuid, text, boolean) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_review_report(uuid, text, uuid, text, boolean) TO service_role;

-- 5.22 prevent_publish_removed_item (guard against re-publishing moderated items)
-- Blocks publish when moderation_status = 'removed' UNLESS moderation_status is
-- simultaneously being reset (admin restore flow via admin_review_report RPC).
CREATE OR REPLACE FUNCTION public.prevent_publish_removed_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status = 'published'
     AND OLD.status <> 'published'
     AND OLD.moderation_status = 'removed'
     AND NEW.moderation_status = 'removed'
  THEN
    RAISE EXCEPTION 'Cannot publish a removed item. Contact support.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- 5.23 normalize_evm_tx_hash (lowercase EVM hashes on write)
CREATE OR REPLACE FUNCTION public.normalize_evm_tx_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.chain IN ('base', 'ethereum') AND NEW.tx_hash IS NOT NULL THEN
    NEW.tx_hash := lower(NEW.tx_hash);
  END IF;
  RETURN NEW;
END;
$$;

-- 5.24 consume_auth_challenge
CREATE OR REPLACE FUNCTION public.consume_auth_challenge(
  p_wallet text, p_nonce text, p_purpose text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_wallet text;
BEGIN
  DELETE FROM public.auth_challenges
  WHERE wallet = p_wallet AND nonce = p_nonce
    AND purpose = p_purpose AND expires_at > pg_catalog.now()
  RETURNING wallet INTO v_wallet;

  IF v_wallet IS NULL THEN RETURN 'not_found'; END IF;
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_challenge(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_auth_challenge(text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_auth_challenge(text,text,text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_auth_challenge(text,text,text) TO service_role;

-- ========================================================================
-- 6. Triggers
-- ========================================================================

-- Full-text search
CREATE TRIGGER trigger_update_search_vector
  BEFORE INSERT OR UPDATE OF title, description, tags
  ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- updated_at triggers
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_knowledge_items_updated_at
  BEFORE UPDATE ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_contents_updated_at
  BEFORE UPDATE ON knowledge_item_contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_webhook_subs_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auth user -> profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Follow count
CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Usefulness score
CREATE TRIGGER trg_usefulness_score
  AFTER INSERT OR UPDATE ON knowledge_feedbacks
  FOR EACH ROW EXECUTE FUNCTION update_usefulness_score();

-- Trust score triggers
CREATE TRIGGER trg_trust_score_on_feedback
  AFTER INSERT OR UPDATE OR DELETE ON knowledge_feedbacks
  FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_feedback();

CREATE TRIGGER trg_trust_score_on_follow
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_follow();

CREATE TRIGGER trg_trust_score_on_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_review();

CREATE TRIGGER trg_trust_score_on_transaction
  AFTER INSERT OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_transaction();

CREATE TRIGGER trg_trust_score_on_transaction_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.seller_id IS DISTINCT FROM NEW.seller_id)
  EXECUTE FUNCTION trg_recalculate_trust_score_on_transaction();

CREATE TRIGGER trg_trust_score_on_item_change
  AFTER DELETE OR UPDATE OF seller_id ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION trg_recalculate_trust_score_on_item_change();

-- Wallet address protection
CREATE TRIGGER trg_prevent_wallet_address_direct_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_address_direct_update();

-- Prevent re-publishing moderated items
CREATE TRIGGER trg_prevent_publish_removed_item
  BEFORE UPDATE OF status ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_publish_removed_item();

-- Normalize EVM tx_hash to lowercase on insert/update
CREATE TRIGGER trg_normalize_evm_tx_hash
  BEFORE INSERT OR UPDATE OF tx_hash ON transactions
  FOR EACH ROW EXECUTE FUNCTION public.normalize_evm_tx_hash();

-- ========================================================================
-- 7. RLS Policies
-- ========================================================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- profiles: column-level UPDATE restriction
-- Only allow self-editable columns; system columns (user_type, follower_count,
-- following_count, trust_score, wallet_address) are managed by service_role RPCs/triggers.
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, bio) ON profiles TO authenticated;

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);

-- knowledge_items
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_items_select" ON knowledge_items
  FOR SELECT USING (
    status = 'published'
    OR seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.knowledge_item_id = knowledge_items.id
        AND t.buyer_id = auth.uid()
        AND t.status = 'confirmed'
    )
  );
CREATE POLICY "knowledge_items_insert" ON knowledge_items
  FOR INSERT WITH CHECK (seller_id = auth.uid());
CREATE POLICY "knowledge_items_update" ON knowledge_items
  FOR UPDATE USING (seller_id = auth.uid());
CREATE POLICY "knowledge_items_delete" ON knowledge_items
  FOR DELETE USING (seller_id = auth.uid());

-- knowledge_items: column-level UPDATE restriction
-- System-managed columns (view_count, purchase_count, average_rating,
-- usefulness_score, moderation_status, search_vector) are service_role only.
-- status is seller-editable but guarded by trigger against re-publishing removed items.
REVOKE UPDATE ON knowledge_items FROM authenticated;
GRANT UPDATE (title, description, content_type, price_sol, price_usdc,
  preview_content, category_id, tags, status, listing_type, metadata,
  seller_disclosure) ON knowledge_items TO authenticated;

-- knowledge_item_contents
ALTER TABLE knowledge_item_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contents_select" ON knowledge_item_contents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_items ki
      WHERE ki.id = knowledge_item_id AND ki.seller_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN knowledge_items ki ON ki.id = t.knowledge_item_id
      WHERE t.knowledge_item_id = knowledge_item_contents.knowledge_item_id
        AND t.buyer_id = auth.uid()
        AND t.status = 'confirmed'
        AND ki.moderation_status <> 'removed'
    )
  );
CREATE POLICY "contents_insert" ON knowledge_item_contents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_items ki
      WHERE ki.id = knowledge_item_id AND ki.seller_id = auth.uid()
    )
  );
CREATE POLICY "contents_update" ON knowledge_item_contents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM knowledge_items ki
      WHERE ki.id = knowledge_item_id AND ki.seller_id = auth.uid()
    )
  );
CREATE POLICY "contents_delete" ON knowledge_item_contents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM knowledge_items ki
      WHERE ki.id = knowledge_item_id AND ki.seller_id = auth.uid()
    )
  );

-- transactions (INSERT is service_role only via Server Actions / API routes)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON transactions FROM PUBLIC, authenticated;
GRANT  INSERT, UPDATE, DELETE ON transactions TO service_role;

-- reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND t.buyer_id = auth.uid()
        AND t.knowledge_item_id = reviews.knowledge_item_id
        AND t.status = 'confirmed'
    )
  );
CREATE POLICY "reviews_update" ON reviews
  FOR UPDATE USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- reviews: only allow updating rating and comment
REVOKE UPDATE ON reviews FROM authenticated;
GRANT UPDATE (rating, comment) ON reviews TO authenticated;

-- api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_select" ON api_keys
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "api_keys_insert" ON api_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "api_keys_delete" ON api_keys
  FOR DELETE USING (user_id = auth.uid());

-- webhook_subscriptions
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_subs_select" ON webhook_subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "webhook_subs_insert" ON webhook_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "webhook_subs_update" ON webhook_subscriptions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "webhook_subs_delete" ON webhook_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- favorites
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);
CREATE POLICY "Anyone can read follows" ON follows
  FOR SELECT USING (true);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- knowledge_feedbacks
ALTER TABLE knowledge_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyers can insert own feedbacks" ON knowledge_feedbacks
  FOR INSERT WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_id
        AND transactions.buyer_id = auth.uid()
        AND transactions.knowledge_item_id = knowledge_feedbacks.knowledge_item_id
        AND transactions.status = 'confirmed'
    )
  );
CREATE POLICY "sellers can read feedbacks on their items" ON knowledge_feedbacks
  FOR SELECT USING (
    knowledge_item_id IN (SELECT id FROM knowledge_items WHERE seller_id = auth.uid())
  );

-- knowledge_item_versions
ALTER TABLE knowledge_item_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_read_own_versions" ON knowledge_item_versions
  FOR SELECT USING (
    knowledge_item_id IN (SELECT id FROM knowledge_items WHERE seller_id = auth.uid())
  );
CREATE POLICY "buyer_read_version_metadata" ON knowledge_item_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.knowledge_item_id = knowledge_item_versions.knowledge_item_id
        AND t.buyer_id = auth.uid()
        AND t.status = 'confirmed'
    )
  );

-- audit_logs (deny all via RLS — service_role bypasses)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON audit_logs FOR ALL USING (false) WITH CHECK (false);

-- wallet_challenges
ALTER TABLE wallet_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own challenges" ON wallet_challenges
  FOR SELECT USING (auth.uid() = user_id);

-- webhook_delivery_logs
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_select" ON webhook_delivery_logs FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM webhook_subscriptions WHERE user_id = auth.uid()
    )
  );

-- knowledge_item_reports
ALTER TABLE knowledge_item_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporters_select_own" ON knowledge_item_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- auth_challenges (no RLS policies — anon/authenticated deny all, service_role bypass)
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- 8. Column-level security
-- ========================================================================

-- knowledge_item_versions: hide full_content from authenticated role
REVOKE ALL ON knowledge_item_versions FROM authenticated;
GRANT SELECT (id, knowledge_item_id, version_number, title, description, preview_content,
  price_sol, price_usdc, tags, metadata, changed_by, change_summary, created_at)
  ON knowledge_item_versions TO authenticated;

-- ========================================================================
-- 9. Table-level REVOKE/GRANT for service_role-only tables
-- ========================================================================

-- webhook_delivery_logs: service_role only for writes
REVOKE INSERT, UPDATE, DELETE ON webhook_delivery_logs FROM PUBLIC, authenticated;
GRANT  INSERT, UPDATE, DELETE ON webhook_delivery_logs TO service_role;

-- knowledge_item_reports: service_role only for writes
REVOKE INSERT, UPDATE, DELETE ON knowledge_item_reports FROM PUBLIC, authenticated;
GRANT  INSERT, UPDATE, DELETE ON knowledge_item_reports TO service_role;

-- ========================================================================
-- 10. Cron jobs (conditional — pg_cron may not be available)
-- ========================================================================

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Cleanup pending transactions older than 30 minutes
    PERFORM cron.schedule(
      'cleanup-pending-tx',
      '*/30 * * * *',
      $cron$
        UPDATE public.transactions
        SET    status     = 'failed',
               updated_at = NOW()
        WHERE  status     = 'pending'
          AND  created_at < NOW() - INTERVAL '30 minutes';
      $cron$
    );

    -- Cleanup expired auth challenges (hourly)
    PERFORM cron.schedule(
      'cleanup-expired-auth-challenges',
      '0 * * * *',
      $cron$DELETE FROM public.auth_challenges WHERE expires_at < NOW()$cron$
    );
  END IF;
END $do$;
