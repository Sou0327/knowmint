-- ========================================================================
-- KnowMint — Seed Data
-- Separated from migrations (Phase 46 squash)
-- ========================================================================

INSERT INTO categories (name, slug, icon) VALUES
  ('ビジネス・仕事',           'business',          'Briefcase'),
  ('テクノロジー・IT',         'technology-it',     'Laptop'),
  ('デザイン・クリエイティブ', 'design-creative',   'Palette'),
  ('学習・教育',               'education-learning', 'GraduationCap'),
  ('ライフスタイル',           'lifestyle',          'Leaf')
ON CONFLICT (slug) DO NOTHING;
