-- PERF-1: Composite partial index for sitemap query
-- SELECT id, updated_at WHERE status='published' ORDER BY updated_at DESC, id DESC
-- Note: CONCURRENTLY cannot be used inside Supabase CLI migration transactions.
-- Table has ~3 rows; lock duration is negligible.
DROP INDEX IF EXISTS public.idx_knowledge_items_published_updated_at;

CREATE INDEX idx_knowledge_items_published_updated_at
  ON public.knowledge_items (updated_at DESC, id DESC)
  WHERE status = 'published';
