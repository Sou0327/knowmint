import { getAdminClient } from "@/lib/supabase/admin";
import { dispatchWithRetry } from "./retry";
import type { WebhookSub } from "./dispatch";

type WebhookEvent =
  | "purchase.completed"
  | "review.created"
  | "listing.published";

const MAX_CONCURRENT_DISPATCHES = 10;

/**
 * Run tasks with bounded concurrency.
 * Processes all items, collecting results regardless of individual failures.
 */
async function runConcurrent<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const item = items[index++];
      await fn(item).catch((err: unknown) => {
        console.error("[webhook] Dispatch error:", err);
      });
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
}

/**
 * Fire a webhook event for all active subscriptions belonging to userId.
 * Dispatches with bounded concurrency (MAX_CONCURRENT_DISPATCHES).
 * Never throws.
 */
export async function fireWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const admin = getAdminClient();

  const { data: subs, error } = await admin
    .from("webhook_subscriptions")
    .select("id, url, secret_encrypted")
    .eq("user_id", userId)
    .eq("active", true)
    .contains("events", [event]);

  if (error) {
    console.error(`[webhook] Failed to query subscriptions for ${event}:`, error);
    return;
  }

  if (!subs || subs.length === 0) return;

  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  await runConcurrent(
    subs as WebhookSub[],
    MAX_CONCURRENT_DISPATCHES,
    (sub) => dispatchWithRetry(sub, payload)
  );
}
