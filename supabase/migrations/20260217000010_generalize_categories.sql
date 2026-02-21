-- Generalize listing categories to be domain-agnostic.
-- This migration is safe to run after the initial AI-specific seed.

BEGIN;

-- Ensure generic categories exist (or are updated).
INSERT INTO categories (name, slug, icon)
VALUES
  ('ビジネス・仕事', 'business', 'Briefcase'),
  ('テクノロジー・IT', 'technology-it', 'Laptop'),
  ('デザイン・クリエイティブ', 'design-creative', 'Palette'),
  ('学習・教育', 'education-learning', 'GraduationCap'),
  ('ライフスタイル', 'lifestyle', 'Leaf')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon;

-- Remap existing items from old category slugs to the new generic slugs.
WITH slug_mapping(old_slug, new_slug) AS (
  VALUES
    ('prompt', 'business'),
    ('tool-def', 'technology-it'),
    ('api', 'design-creative'),
    ('dataset', 'education-learning'),
    ('general', 'lifestyle')
),
category_mapping AS (
  SELECT
    old_cat.id AS old_category_id,
    new_cat.id AS new_category_id
  FROM slug_mapping m
  JOIN categories old_cat ON old_cat.slug = m.old_slug
  JOIN categories new_cat ON new_cat.slug = m.new_slug
)
UPDATE knowledge_items ki
SET category_id = cm.new_category_id
FROM category_mapping cm
WHERE ki.category_id = cm.old_category_id;

-- Remove legacy AI-specific categories once remapped.
DELETE FROM categories
WHERE slug IN ('prompt', 'tool-def', 'dataset', 'api', 'general');

COMMIT;
