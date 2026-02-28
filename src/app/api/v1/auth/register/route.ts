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
  display_name: z.string().min(1).max(100).optional(),
});

/**
 * POST /api/v1/auth/register
 * ウォレット署名でアカウント作成 + API キー即時発行 (認証不要・public endpoint)
 *
 * フロー:
 *   1. 署名検証 (失敗してもチャレンジは消費されない)
 *   2. consume_auth_challenge RPC でチャレンジ消費
 *   3. Supabase Auth ユーザー作成 (handle_new_user トリガーで profiles 自動作成)
 *   4. profiles.wallet_address を更新
 *   5. API キー生成・保存
 *   6. エラーリカバリ: createUser 成功後の失敗で deleteUser
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

  const { wallet: rawWallet, signature, nonce, display_name } = parsed.data;

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
  const message = buildAuthMessage({ wallet, nonce, purpose: "register" });
  const { valid, error: sigError } = verifyWalletSignature({ message, signature, wallet });
  if (!valid) {
    console.error("[auth/register] signature verification failed:", sigError);
    return apiError(API_ERRORS.BAD_REQUEST, "Signature verification failed");
  }

  const admin = getAdminClient();

  // Step 2: チャレンジ消費 (原子的)
  const { data: rpcResult, error: rpcError } = await admin.rpc(
    "consume_auth_challenge",
    { p_wallet: wallet, p_nonce: nonce, p_purpose: "register" }
  );

  if (rpcError) {
    console.error("[auth/register] RPC consume_auth_challenge failed:", rpcError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
  if (rpcResult !== "ok") {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Challenge not found, expired, or already used. Request a new challenge."
    );
  }

  // Step 3: Supabase Auth ユーザー作成
  const displayName = display_name || `Agent_${wallet.slice(0, 8)}`;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: `${wallet}@wallet.knowmint.local`,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      user_type: "agent",
    },
  });

  if (authError || !authData.user) {
    console.error("[auth/register] createUser failed:", authError);
    return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to create user account");
  }

  const newUserId = authData.user.id;

  // Step 4-5: wallet_address 更新 + API キー生成 (並列実行)
  // エラー時は createUser をロールバック
  try {
    // Step 4: profiles.wallet_address 更新
    // service_role は prevent_wallet_address_direct_update トリガーをバイパス
    //   (migration 20260222000019_phase21_security_fixes.sql)
    // .select("id") で更新行の存在を確認 (0 件更新=profile 未作成を検知)
    const updatePromise = admin
      .from("profiles")
      .update({ wallet_address: wallet })
      .eq("id", newUserId)
      .select("id")
      .maybeSingle();

    // Step 5: API キー生成 (30 日有効期限付き — キー肥大化防止)
    const keyPromise = (async () => {
      const { raw, hash } = await generateApiKey();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: keyError } = await admin.from("api_keys").insert({
        user_id: newUserId,
        key_hash: hash,
        name: "auto-provisioned",
        permissions: ["read", "write"],
        last_used_at: null,
        expires_at: expiresAt,
      });
      return { raw, keyError };
    })();

    const [updateResult, keyResult] = await Promise.all([updatePromise, keyPromise]);

    if (updateResult.error) {
      throw new Error(`Profile update failed: ${updateResult.error.message}`);
    }
    if (!updateResult.data) {
      throw new Error("Profile row not found for new user (handle_new_user trigger may have failed)");
    }
    if (keyResult.keyError) {
      throw new Error(`API key creation failed: ${keyResult.keyError.message}`);
    }

    const raw = keyResult.raw;

    logAuditEvent({
      userId: newUserId,
      action: "agent.registered",
      resourceType: "user",
      resourceId: newUserId,
      metadata: { wallet, method: "wallet_signature" },
    });

    return withRateLimitHeaders(
      apiSuccess({ api_key: raw, user_id: newUserId, wallet }),
      rl.remaining,
      rl.resetMs
    );
  } catch (e) {
    // エラーリカバリ: createUser 成功後に後続ステップ失敗
    console.error("[auth/register] post-createUser step failed, rolling back:", e);
    await admin.auth.admin.deleteUser(newUserId).catch((delErr: unknown) => {
      console.error("[auth/register] rollback deleteUser failed:", delErr);
    });
    return apiError(API_ERRORS.INTERNAL_ERROR, "Registration failed. Please try again.");
  }
}
