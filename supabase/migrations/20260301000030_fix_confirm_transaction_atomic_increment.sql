-- confirm_transaction を void → integer に変更:
--   戻り値型の変更は CREATE OR REPLACE では不可 → DROP + CREATE で再作成
--   1. RETURNS integer (実際に pending→confirmed に変更した件数: 0 or 1)
--   2. confirmed に変更した場合のみ knowledge_items.purchase_count を原子的インクリメント

DROP FUNCTION IF EXISTS public.confirm_transaction(uuid);

CREATE FUNCTION public.confirm_transaction(tx_id UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  updated_count integer;
  v_item_id UUID;
BEGIN
  UPDATE public.transactions
  SET status = 'confirmed', updated_at = NOW()
  WHERE id = tx_id AND status = 'pending'
  RETURNING knowledge_item_id INTO v_item_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    UPDATE public.knowledge_items
    SET purchase_count = purchase_count + 1
    WHERE id = v_item_id;
  END IF;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_transaction(uuid) TO service_role;
