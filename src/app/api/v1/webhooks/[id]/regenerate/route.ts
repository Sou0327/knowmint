import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { encryptSecret } from "@/lib/webhooks/crypto";

/**
 * POST /api/v1/webhooks/:id/regenerate
 * Regenerate the signing secret for a webhook subscription.
 * Returns the new plaintext secret once — it cannot be retrieved again.
 */
export const POST = withApiAuth(
  async (_request, user, _rateLimit, context) => {
    const { id } = await context!.params;
    const admin = getAdminClient();

    // Ownership check
    const { data: sub, error: fetchError } = await admin
      .from("webhook_subscriptions")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !sub) {
      return apiError(API_ERRORS.NOT_FOUND, "Webhook subscription not found");
    }

    if (sub.user_id !== user.userId) {
      return apiError(API_ERRORS.FORBIDDEN, "You do not own this webhook subscription");
    }

    // Generate new 32-byte secret with whsec_ prefix
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    const secret =
      "whsec_" +
      Array.from(secretBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    // SHA-256 hash for verification
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(secret) as BufferSource
    );
    const secretHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // AES-256-GCM encrypted copy for HMAC signing (fail-close: reject if key not configured)
    let secretEncrypted: string;
    try {
      secretEncrypted = encryptSecret(secret);
    } catch (err) {
      console.error("encryptSecret failed during regenerate:", err);
      return apiError(
        API_ERRORS.INTERNAL_ERROR,
        "Webhook signing key is not configured on the server"
      );
    }

    const { error: updateError } = await admin
      .from("webhook_subscriptions")
      .update({
        secret_hash: secretHash,
        secret_encrypted: secretEncrypted,
        active: true,
      })
      .eq("id", id)
      .eq("user_id", user.userId);

    if (updateError) {
      console.error("Failed to update webhook secret:", updateError);
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }

    return apiSuccess({ id, plaintext_secret: secret });
  },
  { requiredPermissions: ["write"] }
);
