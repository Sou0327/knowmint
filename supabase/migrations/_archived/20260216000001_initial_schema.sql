-- ========================================
-- Knowledge Market - Initial Schema
-- ========================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ========================================
-- Enums
-- ========================================

CREATE TYPE content_type AS ENUM ('prompt', 'tool_def', 'dataset', 'api', 'general');
CREATE TYPE knowledge_status AS ENUM ('draft', 'published', 'archived', 'suspended');
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');
CREATE TYPE chain_type AS ENUM ('solana', 'base', 'ethereum');
CREATE TYPE token_type AS ENUM ('SOL', 'USDC', 'ETH');

-- ========================================
-- Tables
-- ========================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  wallet_address TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge Items
CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content_type content_type NOT NULL DEFAULT 'general',
  price_sol DECIMAL(18, 9),
  price_usdc DECIMAL(18, 6),
  preview_content TEXT,
  full_content TEXT,
  file_url TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  status knowledge_status NOT NULL DEFAULT 'draft',
  view_count INTEGER NOT NULL DEFAULT 0,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  average_rating DECIMAL(3, 2),
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  amount DECIMAL(18, 9) NOT NULL,
  token token_type NOT NULL DEFAULT 'SOL',
  chain chain_type NOT NULL DEFAULT 'solana',
  tx_hash TEXT,
  status transaction_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  permissions TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ========================================
-- Indexes
-- ========================================

CREATE INDEX idx_knowledge_items_seller ON knowledge_items(seller_id);
CREATE INDEX idx_knowledge_items_status ON knowledge_items(status);
CREATE INDEX idx_knowledge_items_category ON knowledge_items(category_id);
CREATE INDEX idx_knowledge_items_content_type ON knowledge_items(content_type);
CREATE INDEX idx_knowledge_items_created_at ON knowledge_items(created_at DESC);
CREATE INDEX idx_knowledge_items_tags ON knowledge_items USING GIN(tags);
CREATE INDEX idx_knowledge_items_search ON knowledge_items USING GIN(search_vector);

CREATE INDEX idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_transactions_knowledge ON transactions(knowledge_item_id);
CREATE INDEX idx_transactions_status ON transactions(status);

CREATE INDEX idx_reviews_knowledge ON reviews(knowledge_item_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- ========================================
-- Full-text search trigger
-- ========================================

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_search_vector
  BEFORE INSERT OR UPDATE OF title, description, tags
  ON knowledge_items
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();

-- ========================================
-- Updated_at trigger
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- ========================================
-- Auto-create profile on signup
-- ========================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, owners can update
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Categories: anyone can read
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);

-- Knowledge Items: published items are public, drafts only visible to seller
CREATE POLICY "knowledge_items_select" ON knowledge_items
  FOR SELECT USING (
    status = 'published' OR seller_id = auth.uid()
  );
CREATE POLICY "knowledge_items_insert" ON knowledge_items
  FOR INSERT WITH CHECK (seller_id = auth.uid());
CREATE POLICY "knowledge_items_update" ON knowledge_items
  FOR UPDATE USING (seller_id = auth.uid());
CREATE POLICY "knowledge_items_delete" ON knowledge_items
  FOR DELETE USING (seller_id = auth.uid());

-- Transactions: buyers and sellers can see their own
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Reviews: anyone can read, reviewer can insert/update
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "reviews_update" ON reviews
  FOR UPDATE USING (reviewer_id = auth.uid());

-- API Keys: only owner
CREATE POLICY "api_keys_select" ON api_keys
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "api_keys_insert" ON api_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "api_keys_delete" ON api_keys
  FOR DELETE USING (user_id = auth.uid());
