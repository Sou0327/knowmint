"use server";

import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

const emailSchema = z.object({
  email: z.string().email(),
  source: z.string().max(50).default("homepage"),
});

export async function subscribeEmail(
  email: string,
  source = "homepage"
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = emailSchema.safeParse({ email, source });
  if (!parsed.success) {
    return { success: false, error: "Invalid email address" };
  }

  const admin = getAdminClient();
  // email_subscribers は MKT-NOW migration で追加。database.types.ts 再生成前は型未登録。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("email_subscribers")
    .insert({ email: parsed.data.email.toLowerCase(), source: parsed.data.source });

  if (error) {
    // 23505 = unique_violation → already subscribed (treat as success)
    if ((error as { code?: string }).code === "23505") {
      return { success: true };
    }
    console.error("[email-capture] insert failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  return { success: true };
}
