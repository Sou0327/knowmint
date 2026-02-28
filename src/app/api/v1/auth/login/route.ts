import { getAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, API_ERRORS, withRateLimitHeaders } from "@/lib/api/response";
import { checkAuthRateLimit } from "@/lib/api/rate-limit";
import { generateApiKey } from "@/lib/api/auth";
import { buildAuthMessage } from "@/lib/siws/auth-message";
import { verifyWalletSignature } from "@/lib/auth/verify-wallet-signature";
import { logAuditEvent } from "@/lib/audit/log";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

const BodySchema = z.object({
  wallet: z.string().min(32).max(44),
  signature: z.string().min(1).max(200),
  nonce: z.string().regex(/^[0-9a-f]{64}$/, "nonce must be 64-char lowercase hex"),
  key_name: z.string().min(1).max(100).optional(),
});

/**
 * POST /api/v1/auth/login
 * ウォレット署名でログイン + 新 API キー発行 (認証不要・public endpoint)
 *
 * フロー:
 *   1. 署名検証 (失敗してもチャレンジは消費されない)
 *   2. consume_auth_challenge RPC でチャレンジ消費
 *   3. profiles.wallet_address で既存ユーザー特定
 *   4. API キー生成・保存
 */
export async function POST(request: Request) {
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

  const { wallet: rawWallet, signature, nonce, key_name } = parsed.data;

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

  // Step 1: 署名検証 (チャレンジ消費前)
  const message = buildAuthMessage({ wallet, nonce, purpose: "login" });
  const { valid, error: sigError } = verifyWalletSignature({ message, signature, wallet });
  if (!valid) {
    console.error("[auth/login] signature verification failed:", sigError);
    return apiError(API_ERRORS.BAD_REQUEST, "Signature verification failed");
  }

  const admin = getAdminClient();

  // Step 2: チャレンジ消費 (原子的)
  const { data: rpcResult, error: rpcError } = await admin.rpc(
    "consume_auth_challenge",
    { p_wallet: wallet, p_nonce: nonce, p_purpose: "login" }
  );

  if (rpcError) {
    console.error("[auth/login] RPC consume_auth_challenge failed:", rpcError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
  if (rpcResult !== "ok") {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Challenge not found, expired, or already used. Request a new challenge."
    );
  }

  // Step 3: 既存ユーザー特定
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (profileError) {
    console.error("[auth/login] profile lookup error:", profileError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
  if (!profile) {
    // チャレンジ消費後にプロファイル未発見 = データ不整合
    console.error("[auth/login] profile not found after challenge consume for wallet:", wallet);
    return apiError(API_ERRORS.INTERNAL_ERROR, "Account not found. Contact support.");
  }

  // Step 3.5: アクティブ API キー上限チェック (10 件)
  // fail-closed: countError 時もキー発行を拒否
  // 注: count チェックと insert は非原子的だが、rate limit (20/min per IP) により
  //     並行ログインでの超過は最大 1-2 件に抑制される
  const { count, error: countError } = await admin
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .gt("expires_at", new Date().toISOString());

  if (countError) {
    console.error("[auth/login] API key count check failed:", countError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
  if ((count ?? 0) >= 10) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Too many active API keys (max 10). Revoke unused keys first."
    );
  }

  // Step 4: API キー生成 (30 日有効期限付き — キー肥大化防止)
  const { raw, hash } = await generateApiKey();
  const keyName = key_name || "wallet-login";
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: keyError } = await admin.from("api_keys").insert({
    user_id: profile.id,
    key_hash: hash,
    name: keyName,
    permissions: ["read", "write"],
    last_used_at: null,
    expires_at: expiresAt,
  });

  if (keyError) {
    console.error("[auth/login] API key creation failed:", keyError);
    return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to create API key");
  }

  logAuditEvent({
    userId: profile.id,
    action: "agent.login",
    resourceType: "user",
    resourceId: profile.id,
    metadata: { wallet, method: "wallet_signature" },
  });

  return withRateLimitHeaders(
    apiSuccess({ api_key: raw, user_id: profile.id, wallet }),
    rl.remaining,
    rl.resetMs
  );
}
