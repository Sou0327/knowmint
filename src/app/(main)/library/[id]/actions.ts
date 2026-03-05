"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const feedbackSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  useful: z.boolean(),
});

export async function submitFeedback(params: {
  knowledgeItemId: string;
  useful: boolean;
}) {
  const t = await getTranslations("Errors");

  const parsed = feedbackSchema.safeParse(params);
  if (!parsed.success) {
    return { error: t("invalidInput") };
  }

  const { knowledgeItemId, useful } = parsed.data;
  const user = await requireAuth();
  const supabase = await createClient();

  // 購入確認
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("knowledge_item_id", knowledgeItemId)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (txError) {
    console.error("[feedback-action] transaction lookup failed:", txError);
    return { error: t("onlyPurchasedCanFeedback") };
  }

  if (!transaction) {
    return { error: t("onlyPurchasedCanFeedback") };
  }

  // 既存フィードバック確認
  const { data: existing, error: existingError } = await supabase
    .from("knowledge_feedbacks")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("knowledge_item_id", knowledgeItemId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[feedback-action] existing check failed:", existingError);
    return { error: t("feedbackSaveFailed") };
  }

  if (existing) {
    return { error: t("alreadyFeedback") };
  }

  const { error } = await supabase.from("knowledge_feedbacks").insert({
    buyer_id: user.id,
    knowledge_item_id: knowledgeItemId,
    transaction_id: transaction.id,
    useful,
  } as never);

  if (error) {
    if (error.code === "23505") {
      return { error: t("alreadyFeedback") };
    }
    console.error("[feedback-action] insert failed:", error);
    return { error: t("feedbackSaveFailed") };
  }

  revalidatePath(`/library/${knowledgeItemId}`);
  return { error: null };
}
