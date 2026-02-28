-- =============================================================================
-- Phase 15: security-sensitive 関数から anon / PUBLIC 実行権限を剥奪
-- =============================================================================
-- 背景:
--   Supabase ローカル / クラウド環境では ALTER DEFAULT PRIVILEGES により
--   CREATE FUNCTION 時に anon, authenticated, service_role へ EXECUTE が
--   自動付与される。
--   Phase 21 / 23 の REVOKE は PUBLIC / authenticated のみ対象とし、
--   anon への明示的な REVOKE が漏れていた。
--
--   また Phase 8 (notifications) / Phase 9 (trust_score / versioning) の
--   SECURITY DEFINER 関数についても同様の漏れが存在した。
--
--   本 migration では service_role のみが呼び出せるべき関数すべてから
--   anon (および PUBLIC) の EXECUTE 権限を剥奪する。
--
-- 冪等性:
--   REVOKE は対象ロールが権限を持たない場合でもエラーなく完了する。
--   ただし関数が存在しない場合は ERROR になるため、DO $$ で存在チェックを行う。
-- =============================================================================

DO $$
BEGIN

-- ── 1. confirm_transaction (Phase 21 補完) ─────────────────────────────────
IF to_regprocedure('public.confirm_transaction(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM anon;
END IF;

-- ── 2. increment_purchase_count (Phase 23 補完) ────────────────────────────
IF to_regprocedure('public.increment_purchase_count(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.increment_purchase_count(uuid) FROM anon;
END IF;

-- ── 3. increment_view_count (Phase 23 補完) ────────────────────────────────
IF to_regprocedure('public.increment_view_count(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM anon;
END IF;

-- ── 4. update_average_rating (Phase 23 補完) ───────────────────────────────
IF to_regprocedure('public.update_average_rating(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.update_average_rating(uuid) FROM anon;
END IF;

-- ── 5. consume_wallet_challenge (Phase 21 補完) ────────────────────────────
IF to_regprocedure('public.consume_wallet_challenge(text, uuid, text)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.consume_wallet_challenge(text, uuid, text) FROM anon;
END IF;

-- ── 6. create_notification (Phase 8 — 新規制限) ────────────────────────────
--    anon / authenticated が直接 RPC 経由で任意ユーザーへ通知を作れるリスクを排除
IF to_regprocedure('public.create_notification(uuid, text, text, text, text, jsonb)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM anon;
  REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) TO service_role;
END IF;

-- ── 7. recalculate_trust_score (Phase 9 補完) ──────────────────────────────
IF to_regprocedure('public.recalculate_trust_score(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.recalculate_trust_score(uuid) FROM anon;
  REVOKE ALL ON FUNCTION public.recalculate_trust_score(uuid) FROM authenticated;
END IF;

-- ── 8. create_version_snapshot (Phase 9 補完) ──────────────────────────────
--    Phase 9 で FROM PUBLIC は REVOKE 済み。anon / authenticated の漏れを修正。
--    (全11引数のシグネチャ)
IF to_regprocedure('public.create_version_snapshot(uuid,text,text,text,numeric,numeric,text[],jsonb,text,uuid,text)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.create_version_snapshot(uuid,text,text,text,numeric,numeric,text[],jsonb,text,uuid,text) FROM anon;
  REVOKE ALL ON FUNCTION public.create_version_snapshot(uuid,text,text,text,numeric,numeric,text[],jsonb,text,uuid,text) FROM authenticated;
END IF;

-- ── 9. トリガー関数群 (Phase 9 / 補完) ────────────────────────────────────
--    トリガー関数は DB エンジンが呼ぶもので、ユーザーが直接 RPC 経由で呼べる必要はない。
IF to_regprocedure('public.trg_recalculate_trust_score_on_feedback()') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_feedback() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_feedback() FROM anon;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_feedback() FROM authenticated;
END IF;

IF to_regprocedure('public.trg_recalculate_trust_score_on_follow()') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_follow() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_follow() FROM anon;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_follow() FROM authenticated;
END IF;

IF to_regprocedure('public.trg_recalculate_trust_score_on_review()') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_review() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_review() FROM anon;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_review() FROM authenticated;
END IF;

IF to_regprocedure('public.trg_recalculate_trust_score_on_transaction()') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_transaction() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_transaction() FROM anon;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_transaction() FROM authenticated;
END IF;

IF to_regprocedure('public.trg_recalculate_trust_score_on_item_change()') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_item_change() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_item_change() FROM anon;
  REVOKE ALL ON FUNCTION public.trg_recalculate_trust_score_on_item_change() FROM authenticated;
END IF;

END $$;
