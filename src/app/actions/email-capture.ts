"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkEmailCaptureRateLimit } from "@/lib/api/rate-limit";

const emailSchema = z.object({
  email: z.string().email(),
  source: z.string().max(50).default("homepage"),
});

export async function subscribeEmail(
  email: string,
  source = "homepage"
): Promise<{ success: true } | { success: false; error: string }> {
  // Rate limit by IP (reuse existing rate-limit infrastructure)
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown";
  const { allowed } = await checkEmailCaptureRateLimit(ip);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  const parsed = emailSchema.safeParse({ email, source });
  if (!parsed.success) {
    return { success: false, error: "Invalid email address" };
  }

  const admin = getAdminClient();
  const { error } = await admin
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
