-- Phase GEO-6.R1: Replace client-side aggregation with SQL GROUP BY
-- getTopSellers() を 3クエリ+JS集計 → 単一 RPC に置換

CREATE OR REPLACE FUNCTION public.get_top_sellers(p_limit int DEFAULT 10)
RETURNS TABLE(
  id uuid,
  display_name text,
  avatar_url text,
  follower_count int,
  total_sales bigint,
  total_items bigint,
  trust_score numeric
) AS $$
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    p.follower_count,
    COALESCE(t.cnt, 0) AS total_sales,
    COALESCE(k.cnt, 0) AS total_items,
    p.trust_score
  FROM profiles p
  JOIN (
    SELECT seller_id, COUNT(*) AS cnt
    FROM transactions
    WHERE status = 'confirmed'
    GROUP BY seller_id
    ORDER BY cnt DESC, seller_id
    LIMIT p_limit
  ) t ON p.id = t.seller_id
  LEFT JOIN (
    SELECT seller_id, COUNT(*) AS cnt
    FROM knowledge_items
    WHERE status = 'published'
    GROUP BY seller_id
  ) k ON p.id = k.seller_id
  ORDER BY total_sales DESC, p.id;
$$ LANGUAGE sql STABLE SECURITY INVOKER;

-- Phase 21/24 パターン踏襲: anon からのアクセスを禁止
REVOKE ALL ON FUNCTION public.get_top_sellers(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_top_sellers(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_top_sellers(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_sellers(int) TO service_role;
