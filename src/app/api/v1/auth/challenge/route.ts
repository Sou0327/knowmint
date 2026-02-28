import crypto from "node:crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, API_ERRORS, withRateLimitHeaders } from "@/lib/api/response";
import { checkAuthRateLimit } from "@/lib/api/rate-limit";
import { buildAuthMessage } from "@/lib/siws/auth-message";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

const BodySchema = z.object({
  wallet: z.string().min(32).max(44),
  purpose: z.enum(["register", "login"]),
});

/**
 * POST /api/v1/auth/challenge
 * ウォレット署名チャレンジ発行 (認証不要・public endpoint)
 *
 * - purpose="register" → wallet が未登録であることを確認
 * - purpose="login" → wallet が登録済みであることを確認
 */
export async function POST(request: Request) {
  // IP rate limit (20/min)
  const rl = await checkAuthRateLimit(request);
  if (!rl.allowed) {
    return withRateLimitHeaders(
      apiError(API_ERRORS.RATE_LIMITED),
      rl.remaining,
      rl.resetMs
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      parsed.error.issues.map((i) => i.message).join("; ")
    );
  }

  const { wallet: rawWallet, purpose } = parsed.data;

  // Canonical wallet validation
  let wallet: string;
  try {
    wallet = new PublicKey(rawWallet).toBase58();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid Solana wallet address");
  }
  if (wallet !== rawWallet) {
    return apiError(API_ERRORS.BAD_REQUEST, "Wallet address must be in canonical base58 format");
  }

  const admin = getAdminClient();

  // purpose に応じた存在チェック (単一クエリ)
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (lookupError) {
    console.error("[auth/challenge] profile lookup failed:", lookupError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
  if (purpose === "register" && existing) {
    return apiError(API_ERRORS.CONFLICT, "Wallet already registered. Use login instead.");
  }
  if (purpose === "login" && !existing) {
    return apiError(API_ERRORS.NOT_FOUND, "Wallet not registered. Use register first.");
  }

  // nonce 生成
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // UPSERT (wallet UNIQUE — 1 ウォレット 1 チャレンジ)
  const { error: upsertError } = await admin
    .from("auth_challenges")
    .upsert(
      { wallet, nonce, purpose, expires_at: expiresAt },
      { onConflict: "wallet" }
    );

  if (upsertError) {
    console.error("[auth/challenge] upsert failed:", upsertError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  const message = buildAuthMessage({ wallet, nonce, purpose });

  return withRateLimitHeaders(
    apiSuccess({ nonce, message, expires_at: expiresAt }),
    rl.remaining,
    rl.resetMs
  );
}
