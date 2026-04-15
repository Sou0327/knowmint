-- RP1 (T-3): Harden get_top_sellers RPC with explicit search_path
--
-- 根拠: Phase 21/22/23 で全 SECURITY DEFINER 関数に SET search_path を付与したが、
-- get_top_sellers (Phase GEO-6.R1, 20260315000035) は追加漏れ。
-- SECURITY INVOKER なので権限昇格リスクは低いものの、同プロジェクト内の一貫性を保つため
-- SET search_path = pg_catalog, public を明示する。
--
-- シグネチャ / LANGUAGE / STABLE / SECURITY INVOKER は維持。
-- REVOKE / GRANT も Phase 21/24 パターン (anon 禁止 + authenticated/service_role のみ許可) を維持。
-- CREATE OR REPLACE FUNCTION は冪等なので、再適用可能。

CREATE OR REPLACE FUNCTION public.get_top_sellers(p_limit int DEFAULT 10)
RETURNS TABLE(
  id uuid,
  display_name text,
  avatar_url text,
  follower_count int,
  total_sales bigint,
  total_items bigint,
  trust_score numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    p.follower_count,
    COALESCE(t.cnt, 0) AS total_sales,
    COALESCE(k.cnt, 0) AS total_items,
    p.trust_score
  FROM public.profiles p
  JOIN (
    SELECT seller_id, COUNT(*) AS cnt
    FROM public.transactions
    WHERE status = 'confirmed'
    GROUP BY seller_id
    ORDER BY cnt DESC, seller_id
    LIMIT p_limit
  ) t ON p.id = t.seller_id
  LEFT JOIN (
    SELECT seller_id, COUNT(*) AS cnt
    FROM public.knowledge_items
    WHERE status = 'published'
    GROUP BY seller_id
  ) k ON p.id = k.seller_id
  ORDER BY total_sales DESC, p.id;
$$;

-- 既存 GRANT は 20260315000035 で設定済みだが、CREATE OR REPLACE でも
-- ACL は保持されるため再付与は冪等な追加保険。anon 禁止も維持。
REVOKE ALL ON FUNCTION public.get_top_sellers(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_top_sellers(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_top_sellers(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_sellers(int) TO service_role;
