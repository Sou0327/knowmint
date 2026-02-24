import { dispatchWebhook, WebhookSub, WebhookPayload } from "./dispatch";
import { getAdminClient } from "@/lib/supabase/admin";

function recordDeliveryLog(
  sub: WebhookSub,
  payload: WebhookPayload,
  attempt: number,
  status: "failed" | "dead",
  statusCode?: number,
  errorMessage?: string
): void {
  // JSONB 肥大化防止: 4KB 超の場合はイベント名のみ保持
  const rawPayload = { ...payload, data: "[logged]" };
  const safePayload =
    JSON.stringify(rawPayload).length <= 4096
      ? rawPayload
      : { event: payload.event, data: "[logged]", _truncated: true };
  try {
    getAdminClient()
      .from("webhook_delivery_logs")
      .insert({
        subscription_id: sub.id,
        event: payload.event,
        attempt,
        status,
        status_code: statusCode ?? null,
        error_message: errorMessage ?? null,
        payload: safePayload,
      })
      .then(() => {}, (err: unknown) => console.error("[webhook] failed to record delivery log:", err));
  } catch (err) {
    console.error("[webhook] admin client unavailable for delivery log:", err);
  }
}

/**
 * Permanent errors that should not be retried.
 * Note: "dns_error" is NOT here — DNS failures are transient and should be retried.
 *       "ssrf_rejected" means the resolved IP was private/invalid → permanent.
 */
const PERMANENT_ERRORS = new Set([
  "no_signing_secret",
  "decrypt_failed",
  "ssrf_rejected",
]);

function isPermanentStatusCode(code: number | undefined): boolean {
  if (code === undefined) return false;
  // 4xx (except 429 Too Many Requests) are permanent client-side errors.
  return code >= 400 && code < 500 && code !== 429;
}

/**
 * Dispatch a webhook with exponential backoff retry.
 * Attempt delays: 1s, 2s between retries (3 attempts total, jitter ±10%).
 * Permanent errors (4xx, decrypt_failed, ssrf_rejected) are not retried.
 * Silently logs failures; never throws.
 */
export async function dispatchWithRetry(
  sub: WebhookSub,
  payload: WebhookPayload,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await dispatchWebhook(sub, payload);

    if (result.success) return;

    // Permanent errors — no point retrying
    if (result.error && PERMANENT_ERRORS.has(result.error)) {
      console.warn(
        `[webhook:${sub.id}] Permanent failure: ${result.error}, skipping retries`
      );
      recordDeliveryLog(sub, payload, attempt, "dead", result.statusCode, result.error);
      return;
    }

    if (isPermanentStatusCode(result.statusCode)) {
      console.warn(
        `[webhook:${sub.id}] Permanent HTTP ${result.statusCode}, skipping retries`
      );
      recordDeliveryLog(sub, payload, attempt, "dead", result.statusCode, result.error);
      return;
    }

    if (attempt < maxRetries) {
      const baseMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      // ±10% jitter to avoid thundering herd
      const jitter = baseMs * 0.1 * (Math.random() * 2 - 1);
      const delayMs = Math.round(baseMs + jitter);
      console.warn(
        `[webhook:${sub.id}] Attempt ${attempt}/${maxRetries} failed ` +
          `(${result.error ?? result.statusCode}), retrying in ${delayMs}ms`
      );
      recordDeliveryLog(sub, payload, attempt, "failed", result.statusCode, result.error);
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    } else {
      console.error(
        `[webhook:${sub.id}] All ${maxRetries} attempts failed. ` +
          `Last error: ${result.error ?? result.statusCode}`
      );
      recordDeliveryLog(sub, payload, attempt, "dead", result.statusCode, result.error);
    }
  }
}
