import { createHmac } from "node:crypto";
import { Agent, fetch as undiciFetch } from "undici";
import { decryptSecret } from "./crypto";
import { checkPublicUrl } from "./ssrf";

const DISPATCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "KnowledgeMarket-Webhook/1.0";

export interface WebhookSub {
  id: string;
  url: string;
  secret_encrypted: string | null;
}

export interface WebhookPayload {
  event: string;
  data: unknown;
  timestamp: string;
}

export interface DispatchResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Dispatch a single webhook delivery.
 * - Validates the URL via DNS resolution (SSRF check).
 * - Pins the resolved IP in the undici Agent to prevent DNS rebinding (TOCTOU).
 * - Signs the payload with HMAC-SHA256.
 * - Disables redirects to prevent redirect-based SSRF.
 * Returns a result object; never throws.
 */
export async function dispatchWebhook(
  sub: WebhookSub,
  payload: WebhookPayload
): Promise<DispatchResult> {
  if (!sub.secret_encrypted) {
    return { success: false, error: "no_signing_secret" };
  }

  // Validate URL and resolve DNS — must happen before connection.
  // Returns the resolved IP so we can pin it in undici to prevent rebinding.
  const ssrfResult = await checkPublicUrl(sub.url);
  if (!ssrfResult.safe) {
    // Log only the origin (scheme + host + port) to avoid leaking credentials,
    // tokens, or signed query parameters that may appear in the URL.
    const safeUrlForLog = (() => {
      try { return new URL(sub.url).origin; } catch { return "[invalid url]"; }
    })();
    console.error(
      `[webhook:${sub.id}] SSRF check failed (${ssrfResult.reason}): ${safeUrlForLog}`
    );
    // Preserve distinction: dns_error is retryable; private_ip/invalid_url are permanent.
    return {
      success: false,
      error: ssrfResult.reason === "dns_error" ? "dns_error" : "ssrf_rejected",
    };
  }

  let secret: string;
  try {
    secret = decryptSecret(sub.secret_encrypted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`[webhook:${sub.id}] Failed to decrypt secret: ${msg}`);
    return { success: false, error: "decrypt_failed" };
  }

  const body = JSON.stringify(payload);
  const signature =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  // Pin the pre-validated IP address in the undici Agent.
  // This prevents DNS rebinding: even if the DNS record changes between our
  // check and the actual TCP connection, we connect to the IP we already validated.
  const pinnedIp = ssrfResult.resolvedIp;
  const agent = new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => {
        callback(null, [{ address: pinnedIp, family: ssrfResult.family }]);
      },
    },
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    // Use undici fetch with the IP-pinned agent.
    // The URL still contains the original hostname so TLS SNI works correctly.
    const response = await undiciFetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-KM-Event": payload.event,
        "X-KM-Signature": signature,
        "User-Agent": USER_AGENT,
      },
      body,
      // Prevent redirect-based SSRF
      redirect: "error",
      signal: controller.signal,
      dispatcher: agent,
    });

    return { success: response.ok, statusCode: response.status };
  } catch (err) {
    const isTimeout =
      err instanceof Error && err.name === "AbortError";
    return {
      success: false,
      error: isTimeout ? "timeout" : String(err),
    };
  } finally {
    clearTimeout(timeoutId);
    // Destroy the per-request agent to release connections
    agent.destroy().catch(() => {});
  }
}
