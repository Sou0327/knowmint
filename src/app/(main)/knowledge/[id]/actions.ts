"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/session";

const reviewSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().default(""),
});

export async function submitReview(params: {
  knowledgeItemId: string;
  rating: number;
  comment: string;
}) {
  const t = await getTranslations("Errors");

  // Zod バリデーション
  const parsed = reviewSchema.safeParse(params);
  if (!parsed.success) {
    return { error: t("invalidInput") };
  }

  const { knowledgeItemId, rating, comment } = parsed.data;
  const user = await requireAuth();
  const supabase = await createClient();

  // Find the user's transaction for this item
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("knowledge_item_id", knowledgeItemId)
    .eq("status", "confirmed")
    .maybeSingle<{ id: string }>();

  if (txError) {
    console.error("[review-action] transaction lookup failed:", txError);
    return { error: t("reviewCheckFailed") };
  }

  if (!transaction) {
    return { error: t("onlyPurchasedCanReview") };
  }

  // Check for existing review
  const { data: existingReview, error: reviewCheckError } = await supabase
    .from("reviews")
    .select("id")
    .eq("transaction_id", transaction.id)
    .maybeSingle();

  if (reviewCheckError) {
    console.error("[review-action] existing review check failed:", reviewCheckError);
    return { error: t("reviewCheckFailed") };
  }

  if (existingReview) {
    return { error: t("alreadyReviewed") };
  }

  const { error } = await supabase.from("reviews").insert({
    transaction_id: transaction.id,
    reviewer_id: user.id,
    knowledge_item_id: knowledgeItemId,
    rating,
    comment: comment || null,
  } as never);

  if (error) {
    console.error("[review-action] insert failed:", error);
    return { error: t("reviewSaveFailed") };
  }

  // 平均レーティング更新 (Admin クライアント使用: service_role 権限が必要)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getAdminClient().rpc as any)("update_average_rating", { item_id: knowledgeItemId }).then(() => {}, () => {});

  return { error: null };
}
