import { getAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * GET /api/cron/cleanup-pending-tx
 * 手動トリガー用エンドポイント。
 * スケジュール実行は Supabase pg_cron が担う (vercel.json 不要)。
 * pending 状態のまま30分以上経過したトランザクションを failed に更新する。
 *
 * 認可: Authorization: Bearer ${CRON_SECRET}
 * CRON_SECRET 未設定時: 開発環境 (NODE_ENV !== "production") のみスキップ、本番は 401。
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${cronSecret}`;
    // タイミングアタック防止: 長さが異なる場合も定時間比較
    const providedBuf = Buffer.from(authHeader.padEnd(expected.length, "\0"));
    const expectedBuf = Buffer.from(expected.padEnd(authHeader.length, "\0"));
    const same =
      providedBuf.length === expectedBuf.length &&
      timingSafeEqual(providedBuf, expectedBuf);
    if (!same) {
      return apiError(API_ERRORS.UNAUTHORIZED, "Invalid cron secret");
    }
  } else if (process.env.NODE_ENV === "production") {
    // 本番環境では CRON_SECRET 必須
    console.error("[cron/cleanup-pending-tx] CRON_SECRET is not set in production");
    return apiError(API_ERRORS.UNAUTHORIZED, "Cron secret not configured");
  }

  const admin = getAdminClient();

  // 30分以上前に作成された pending トランザクションを failed に更新
  // count: "exact" を使用して件数のみ取得しメモリ効率を改善
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("transactions")
    .update({ status: "failed" }, { count: "exact" })
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[cron/cleanup-pending-tx] update failed:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  const cleaned = count ?? 0;
  console.log(`[cron/cleanup-pending-tx] cleaned ${cleaned} pending transactions`);

  return apiSuccess({ cleaned });
}
