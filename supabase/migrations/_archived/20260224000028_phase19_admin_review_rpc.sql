-- Phase 19: 管理者レポートレビューを原子的に実行する RPC
-- knowledge_item_reports 更新と knowledge_items 更新を同一トランザクションで実施

CREATE OR REPLACE FUNCTION public.admin_review_report(
  p_report_id    UUID,
  p_new_status   TEXT,
  p_reviewer_id  UUID,
  p_reviewer_note TEXT,
  p_remove_item  BOOLEAN
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_knowledge_item_id UUID;
BEGIN
  -- p_new_status の入力バリデーション (defense-in-depth)
  IF p_new_status NOT IN ('pending', 'reviewing', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status value: %', p_new_status;
  END IF;

  -- 報告の存在確認と knowledge_item_id 取得
  SELECT knowledge_item_id INTO v_knowledge_item_id
  FROM public.knowledge_item_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found: %', p_report_id;
  END IF;

  -- resolve + remove_item: アイテムを同一トランザクション内で変更
  IF p_remove_item AND p_new_status = 'resolved' THEN
    UPDATE public.knowledge_items
    SET status = 'draft', moderation_status = 'removed'
    WHERE id = v_knowledge_item_id;
  END IF;

  -- 報告ステータスを更新
  UPDATE public.knowledge_item_reports
  SET
    status        = p_new_status,
    reviewer_id   = p_reviewer_id,
    reviewer_note = p_reviewer_note,
    reviewed_at   = NOW()
  WHERE id = p_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_report(uuid, text, uuid, text, boolean) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_report(uuid, text, uuid, text, boolean) TO service_role;
