"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { sendEmail } from "@/lib/email/send";
import { purchaseCompletedEmailHtml } from "@/lib/email/templates";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import {
  recordPurchaseCore,
  type PurchaseCoreFailure,
  type PurchaseCoreSuccess,
} from "@/lib/api/payments/purchase-core";

const schema = z.object({
  knowledgeId: z.string().uuid(),
  txHash: z.string().min(1).max(256),
  chain: z.enum(["solana"]),
  token: z.enum(["SOL", "USDC"]),
  termsAgreed: z.literal(true, {
    errorMap: () => ({ message: "利用規約への同意が必要です" }),
  }),
});

/**
 * Map purchase-core failure reasons to Japanese UI messages.
 *
 * The core layer returns stable string keys (e.g. "invalid_tx_hash_format")
 * so that the API route can keep its existing English messages while this
 * Server Action surfaces localized Japanese text for the web UI. Keeping the
 * translation here — instead of inside the core — avoids leaking locale
 * concerns into shared business logic.
 */
function mapFailure(failure: PurchaseCoreFailure): { success: false; error: string } {
  switch (failure.reason) {
    case "tx_hash_required":
    case "chain_not_supported":
    case "token_not_supported":
      return { success: false, error: "Invalid input" };
    case "invalid_tx_hash_format":
      return { success: false, error: "Invalid Solana transaction hash format" };
    case "item_not_found":
    case "item_not_published":
      return { success: false, error: "Item not found or not available" };
    case "request_listing_not_purchasable":
      return { success: false, error: "Request listings cannot be purchased" };
    case "self_purchase_forbidden":
      return { success: false, error: "Cannot purchase your own item" };
    case "price_not_set_for_token":
      return { success: false, error: "Item has no price set for the selected token" };
    case "wallet_lookup_failed":
      return { success: false, error: "Failed to resolve wallet addresses" };
    case "wallet_not_configured":
      return { success: false, error: "Buyer and seller wallet addresses must be configured" };
    case "invalid_wallet_format":
      return { success: false, error: "Invalid wallet address format" };
    case "verification_failed":
      return { success: false, error: "トランザクション検証に失敗しました" };
    case "confirm_failed":
      return { success: false, error: "Transaction confirmation failed" };
    case "confirm_retry_failed":
      return { success: false, error: "Transaction confirmation retry failed" };
    case "insert_failed":
      return { success: false, error: "Failed to record purchase" };
    case "tx_hash_already_used":
      return { success: false, error: "Transaction hash already used" };
    default:
      return { success: false, error: "Database error" };
  }
}

/**
 * Narrowed success variant for the created-row branch only. Idempotent
 * replays do not carry item/profile data and do not send email.
 */
type PurchaseCreated = Extract<PurchaseCoreSuccess, { created: true }>;

function queueSellerEmail(
  userId: string,
  knowledgeId: string,
  success: PurchaseCreated,
  token: "SOL" | "USDC",
): void {
  const { item, sellerProfile, transaction } = success;
  const admin = getAdminClient();
  const sellerId = item.seller_id;
  const itemTitle = item.title ?? knowledgeId;
  const amount = transaction.amount;
  fireAndForget(
    admin.auth.admin
      .getUserById(sellerId)
      .then(({ data: sellerAuth }) => {
        const sellerEmail = sellerAuth?.user?.email;
        if (!sellerEmail) return;
        const content = purchaseCompletedEmailHtml({
          sellerName: sellerProfile.display_name ?? "seller",
          itemTitle,
          amount,
          token,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://knowmint.shop",
        });
        return sendEmail({ to: sellerEmail, ...content });
      }),
    "purchase.seller_email",
  );
  // Log the completing actor for traceability without surfacing PII.
  console.info("[recordPurchase] completed", {
    userId,
    knowledgeId,
    sellerId,
    txId: transaction.id,
  });
}

export async function recordPurchase(
  knowledgeId: string,
  txHash: string,
  chain: "solana",
  token: "SOL" | "USDC",
  termsAgreed: true,
): Promise<{ success: boolean; error?: string }> {
  const parsed = schema.safeParse({ knowledgeId, txHash, chain, token, termsAgreed });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminClient();
  const result = await recordPurchaseCore({
    admin,
    userId: user.id,
    knowledgeId,
    txHash,
    token,
    chain,
  });

  if (!result.ok) {
    return mapFailure(result);
  }

  // Fire email on newly created rows only; idempotent replays skip email to
  // avoid duplicate notifications.
  if (result.created) {
    queueSellerEmail(user.id, knowledgeId, result, token);
  }
  return { success: true };
}
