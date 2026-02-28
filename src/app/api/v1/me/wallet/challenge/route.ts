import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { buildSiwsMessage } from "@/lib/siws/message";

/** Web Crypto API で 32 バイトの hex nonce を生成 (CF Workers / Node.js 両対応) */
function generateHexNonce(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

const BodySchema = z.object({
  wallet: z.string().min(32).max(44),
});

/**
 * POST /api/v1/me/wallet/challenge
 * Sign-In With Solana (SIWS) — ウォレット所有証明用チャレンジ発行
 *
 * リクエスト: { wallet: string }
 * レスポンス: { nonce: string, message: string, expires_at: string }
 *
 * クライアントはこの `message` を Solana ウォレットで署名し、
 * POST /api/v1/me/wallet/verify に送信して所有証明を完了する。
 */
export const POST = withApiAuth(async (request, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(API_ERRORS.BAD_REQUEST, "wallet must be a valid Solana address (32-44 chars)");
  }

  const { wallet: rawWallet } = parsed.data;

  // Canonical wallet validation — same as verify route
  let wallet: string;
  try {
    wallet = new PublicKey(rawWallet).toBase58();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid Solana wallet address");
  }
  if (wallet !== rawWallet) {
    return apiError(API_ERRORS.BAD_REQUEST, "Wallet address must be in canonical base58 format");
  }

  // [Fix-4] No pre-existence check here.
  // A wallet already claimed by another user will be caught by the UNIQUE constraint
  // at profile update time in /verify. Early checking here is TOCTOU-unsafe anyway.

  const admin = getAdminClient();

  // Generate cryptographically secure nonce (lowercase hex to match Zod in verify)
  const nonce = generateHexNonce();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Upsert challenge (user+wallet → one active challenge at a time)
  const { error: upsertError } = await admin
    .from("wallet_challenges")
    .upsert(
      {
        user_id: user.userId,
        wallet,
        nonce,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" } // [Fix-1] 1ユーザー1チャレンジ — wallet 変更でも上書きして肥大化防止
    );

  if (upsertError) {
    console.error("wallet/challenge: failed to store challenge:", upsertError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  // Build the message the user must sign.
  // [Fix-2] expires_at is NOT included to avoid timestamp re-serialization drift in verify.
  // The nonce provides uniqueness and replay protection.
  const message = buildSiwsMessage({ wallet, nonce, userId: user.userId });

  return apiSuccess({ nonce, message, expires_at: expiresAt });
}, { requiredPermissions: ["write"] });

