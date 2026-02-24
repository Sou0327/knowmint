-- Phase 19: コンテンツモデレーション

-- knowledge_items に moderation_status カラムを追加
ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'none'
    CONSTRAINT mod_status_check CHECK (moderation_status IN ('none', 'under_review', 'removed'));

-- 報告テーブル
CREATE TABLE public.knowledge_item_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  reporter_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason            TEXT NOT NULL CONSTRAINT reason_check
    CHECK (reason IN ('spam', 'illegal', 'misleading', 'inappropriate', 'copyright', 'other')),
  description       TEXT CONSTRAINT desc_len CHECK (char_length(description) <= 1000),
  status            TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT status_check CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewer_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note     TEXT CONSTRAINT note_len CHECK (char_length(reviewer_note) <= 1000),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reports_unique_per_user UNIQUE (knowledge_item_id, reporter_id)
);

CREATE INDEX reports_item_status_idx
  ON public.knowledge_item_reports (knowledge_item_id, status);

CREATE INDEX reports_status_created_idx
  ON public.knowledge_item_reports (status, created_at DESC);

-- 自動フラグ関数: pending 報告 5件以上で under_review に変更
CREATE OR REPLACE FUNCTION public.maybe_flag_for_review(p_item_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
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

REVOKE ALL ON FUNCTION public.maybe_flag_for_review(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_flag_for_review(uuid) TO service_role;

-- RLS
ALTER TABLE public.knowledge_item_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporters_select_own" ON public.knowledge_item_reports FOR SELECT
  USING (reporter_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.knowledge_item_reports FROM PUBLIC, authenticated;
GRANT  INSERT, UPDATE, DELETE ON public.knowledge_item_reports TO service_role;
