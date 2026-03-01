import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { createDatasetSignedDownloadUrl } from "@/lib/storage/datasets";
import {
  buildX402Body,
  parseXPaymentHeader,
  getNetwork,
  getUsdcMintForNetwork,
  isSupportedNetwork,
  checkNetworkConsistency,
  priceToAtomic,
} from "@/lib/x402";
import {
  verifySolanaPurchaseTransaction,
  isValidSolanaTxHash,
} from "@/lib/solana/verify-transaction";

const X402_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

/** Supabase "no rows" error code (PGRST116) */
const SUPABASE_NOT_FOUND = "PGRST116";

/**
 * GET /api/v1/knowledge/[id]/content
 * Returns full content for purchased items or seller's own items.
 * Supports x402 HTTP payment protocol via X-PAYMENT header.
 * Supports ?format=raw for plain text output.
 */
export const GET = withApiAuth(async (request, user, _rateLimit, context) => {
  // X402_NETWORK と NEXT_PUBLIC_SOLANA_NETWORK の整合確認（不一致時は 500 で停止）
  if (!checkNetworkConsistency()) {
    return apiError(API_ERRORS.INTERNAL_ERROR, "Payment network configuration error");
  }
  const { id } = await context!.params;
  const admin = getAdminClient();

  // Fetch item with price/status fields for x402 402 responses and purchase gate
  const { data: item, error: itemError } = await admin
    .from("knowledge_items")
    .select("seller_id, price_sol, price_usdc, status, listing_type")
    .eq("id", id)
    .single();

  if (itemError) {
    if (itemError.code === SUPABASE_NOT_FOUND) return apiError(API_ERRORS.NOT_FOUND);
    console.error("[content] fetch item failed:", { itemId: id, error: itemError });
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
  if (!item) return apiError(API_ERRORS.NOT_FOUND);

  // Deny access for non-published or request-type items (mirrors purchase/route.ts logic)
  if (item.status !== "published" || item.listing_type === "request") {
    return apiError(API_ERRORS.NOT_FOUND);
  }

  const isSeller = item.seller_id === user.userId;
  const xPaymentHeader = request.headers.get("X-PAYMENT");

  if (xPaymentHeader && !isSeller) {
    // ── x402 payment flow (出品者は X-PAYMENT ヘッダ無視で直接閲覧可) ───────
    const payment = parseXPaymentHeader(xPaymentHeader);
    if (!payment || !isValidSolanaTxHash(payment.txHash)) {
      return NextResponse.json(
        { x402Version: 1, accepts: [], error: "Invalid X-PAYMENT header" },
        { status: 402, headers: X402_HEADERS }
      );
    }

    // [Fix] scheme は "exact" のみ許可
    if (payment.scheme !== "exact") {
      return NextResponse.json(
        { x402Version: 1, accepts: [], error: "Unsupported payment scheme" },
        { status: 402, headers: X402_HEADERS }
      );
    }

    // [Fix] network 不一致 + 未知 network を早期 reject
    if (!isSupportedNetwork(payment.network) || payment.network !== getNetwork()) {
      return NextResponse.json(
        { x402Version: 1, accepts: [], error: "Network mismatch" },
        { status: 402, headers: X402_HEADERS }
      );
    }

    // Idempotency: check if this tx_hash is already recorded with full field validation
    // [Fix-1] buyer_id だけでなく knowledge_item_id・status も検証して再利用攻撃を防ぐ
    const { data: existingTx, error: existingTxError } = await admin
      .from("transactions")
      .select("id, buyer_id, knowledge_item_id, status")
      .eq("tx_hash", payment.txHash)
      .maybeSingle();

    if (existingTxError) {
      console.error("[content] x402 check existing tx failed:", { userId: user.userId, itemId: id, error: existingTxError });
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }

    if (existingTx) {
      // All fields must match AND status must be confirmed for idempotent success
      if (
        existingTx.buyer_id !== user.userId ||
        existingTx.knowledge_item_id !== id ||
        existingTx.status !== "confirmed"
      ) {
        return apiError(API_ERRORS.CONFLICT, "Transaction hash already used");
      }
      // Exact match + confirmed → fall through to serve content

    } else {
      // [Fix-3] Fetch both seller and buyer wallets in parallel for expectedSender check
      const [sellerResult, buyerResult] = await Promise.all([
        admin.from("profiles").select("wallet_address").eq("id", item.seller_id).single(),
        admin.from("profiles").select("wallet_address").eq("id", user.userId).single(),
      ]);

      if (sellerResult.error && sellerResult.error.code !== SUPABASE_NOT_FOUND) {
        console.error("[content] x402 fetch seller profile failed:", { itemId: id, error: sellerResult.error });
        return apiError(API_ERRORS.INTERNAL_ERROR);
      }
      if (buyerResult.error && buyerResult.error.code !== SUPABASE_NOT_FOUND) {
        console.error("[content] x402 fetch buyer profile failed:", { userId: user.userId, error: buyerResult.error });
        return apiError(API_ERRORS.INTERNAL_ERROR);
      }

      const sellerWallet = sellerResult.data?.wallet_address;
      const buyerWallet = buyerResult.data?.wallet_address;

      if (!sellerWallet) {
        return apiError(API_ERRORS.INTERNAL_ERROR, "Seller wallet not configured");
      }
      if (!buyerWallet) {
        return apiError(
          API_ERRORS.BAD_REQUEST,
          "Buyer wallet not configured. Set up a wallet before purchasing."
        );
      }

      // [Fix] 既知 asset のみ許可 (native=SOL, network に対応する USDC mint のみ)
      // asset 未指定は parseXPaymentHeader が "native" に正規化済み (後方互換)
      const isNativeAsset = payment.asset === "native";
      // 許可 network の mint のみ。未知 network では undefined → isUsdcAsset = false
      const expectedUsdcMint = getUsdcMintForNetwork(payment.network);
      const isUsdcAsset = expectedUsdcMint !== undefined && payment.asset === expectedUsdcMint;
      if (!isNativeAsset && !isUsdcAsset) {
        return NextResponse.json(
          { x402Version: 1, accepts: [], error: "Unsupported asset" },
          { status: 402, headers: X402_HEADERS }
        );
      }
      const token: "SOL" | "USDC" = isNativeAsset ? "SOL" : "USDC";
      const expectedAmount =
        token === "SOL" ? item.price_sol : item.price_usdc;

      if (!expectedAmount || expectedAmount <= 0) {
        return apiError(API_ERRORS.BAD_REQUEST, "No price set for selected token");
      }
      // priceToAtomic (x402/index.ts) と decimalToAtomic (verify-transaction.ts) は
      // 同一 toFixed ロジック — 丸め境界の一致を保証
      const atomicAmount = priceToAtomic(expectedAmount, token === "SOL" ? 9 : 6);
      if (atomicAmount < BigInt(1)) {
        return apiError(API_ERRORS.BAD_REQUEST, "Price too small to verify");
      }

      // [Fix-3] Pass expectedSender to prevent tx front-running / third-party hash theft
      const verification = await verifySolanaPurchaseTransaction({
        txHash: payment.txHash,
        token,
        expectedRecipient: sellerWallet,
        expectedAmount,
        expectedSender: buyerWallet,
      });

      if (!verification.valid) {
        return NextResponse.json(
          buildX402Body({
            resourceUrl: new URL(
              `/api/v1/knowledge/${id}/content`,
              request.url
            ).toString(),
            description: `Knowledge item ${id}`,
            price_sol: item.price_sol,
            price_usdc: item.price_usdc,
            sellerAddress: sellerWallet,
            error: "Payment verification failed",
          }),
          { status: 402, headers: X402_HEADERS }
        );
      }

      // Record as pending then confirm via RPC (purchase_count atomic increment)
      const { data: insertedTx, error: insertErr } = await admin.from("transactions").insert({
        buyer_id: user.userId,
        seller_id: item.seller_id,
        knowledge_item_id: id,
        amount: expectedAmount,
        token,
        chain: "solana" as const,
        tx_hash: payment.txHash,
        status: "pending" as const,
        protocol_fee: 0,
        fee_vault_address: null,
      }).select("id").single();

      if (insertErr) {
        if (insertErr.code === "23505") {
          // [Fix-2] TOCTOU: concurrent request already inserted — re-read and validate
          const { data: raceTx, error: raceTxError } = await admin
            .from("transactions")
            .select("buyer_id, knowledge_item_id, status")
            .eq("tx_hash", payment.txHash)
            .maybeSingle();

          if (raceTxError) {
            console.error("[content] x402 re-read tx after conflict failed:", { userId: user.userId, itemId: id, error: raceTxError });
            return apiError(API_ERRORS.INTERNAL_ERROR);
          }

          if (
            raceTx?.buyer_id === user.userId &&
            raceTx?.knowledge_item_id === id &&
            raceTx?.status === "confirmed"
          ) {
            // Our payment was already recorded by a concurrent request — safe to continue
          } else {
            return apiError(API_ERRORS.CONFLICT, "Transaction hash already used");
          }
        } else {
          // [Fix-2] Non-duplicate errors → fail-close; never serve content without a record
          console.error("[content] x402 record transaction failed:", { userId: user.userId, itemId: id, error: insertErr });
          return apiError(API_ERRORS.INTERNAL_ERROR);
        }
      } else {
        // Confirm via RPC to atomically increment purchase_count
        const { error: confirmErr } = await admin.rpc("confirm_transaction", {
          tx_id: insertedTx.id,
        });
        if (confirmErr) {
          console.error("[content] x402 confirm_transaction failed:", { userId: user.userId, itemId: id, error: confirmErr });
          // continue serving content — transaction is recorded, count will be fixed by cron
        }
      }
    }
    // Payment verified or idempotent match → fall through to serve content

  } else if (!isSeller) {
    // ── Classic flow: check confirmed purchase ─────────────────────────────
    const { data: transaction, error: txCheckError } = await admin
      .from("transactions")
      .select("id")
      .eq("buyer_id", user.userId)
      .eq("knowledge_item_id", id)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();

    if (txCheckError) {
      console.error("[content] check purchase failed:", { userId: user.userId, itemId: id, error: txCheckError });
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }

    if (!transaction) {
      // No payment → HTTP 402 Payment Required (x402 compatible)
      const { data: sp, error: spError } = await admin
        .from("profiles")
        .select("wallet_address")
        .eq("id", item.seller_id)
        .single();

      if (spError && spError.code !== SUPABASE_NOT_FOUND) {
        console.error("[content] fetch seller profile for 402 failed:", { itemId: id, error: spError });
        return apiError(API_ERRORS.INTERNAL_ERROR);
      }

      // seller wallet 未設定では payTo が空になるため 402 を返せない
      if (!sp?.wallet_address) {
        console.error("[content] seller wallet not configured:", { itemId: id });
        return apiError(API_ERRORS.INTERNAL_ERROR, "Seller wallet not configured");
      }

      return NextResponse.json(
        buildX402Body({
          resourceUrl: new URL(
            `/api/v1/knowledge/${id}/content`,
            request.url
          ).toString(),
          description: `Knowledge item ${id}`,
          price_sol: item.price_sol,
          price_usdc: item.price_usdc,
          sellerAddress: sp.wallet_address,
        }),
        { status: 402, headers: X402_HEADERS }
      );
    }
  }

  // ── Serve content ──────────────────────────────────────────────────────
  const { data: content, error: contentError } = await admin
    .from("knowledge_item_contents")
    .select("full_content, file_url")
    .eq("knowledge_item_id", id)
    .single();

  if (contentError) {
    if (contentError.code === SUPABASE_NOT_FOUND) {
      return apiError(API_ERRORS.NOT_FOUND, "Content not found");
    }
    console.error("[content] fetch content failed:", { itemId: id, error: contentError });
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
  if (!content) return apiError(API_ERRORS.NOT_FOUND, "Content not found");

  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format === "raw" && content.full_content) {
    return new Response(content.full_content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const signedFileUrl = content.file_url
    ? await createDatasetSignedDownloadUrl(admin, content.file_url, 900)
    : null;

  return apiSuccess({
    full_content: content.full_content,
    file_url: signedFileUrl || content.file_url,
  });
}, { requiredPermissions: ["read"] });
