import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { buildSiwsMessage } from "@/lib/siws/message";
import { verifyWalletSignature } from "@/lib/auth/verify-wallet-signature";

const BodySchema = z.object({
  wallet: z.string().min(32).max(44),
  // No Zod regex on signature — decodeSignature handles format validation strictly
  signature: z.string().min(1).max(200),
  // nonce must be lowercase hex to match randomBytes().toString("hex") output
  nonce: z.string().regex(/^[0-9a-f]{64}$/, "nonce must be 64-char lowercase hex"),
});

/**
 * POST /api/v1/me/wallet/verify
 * Sign-In With Solana (SIWS) — 署名検証 + wallet_address 保存
 *
 * リクエスト: { wallet: string, signature: string, nonce: string }
 * - wallet: Solana public key (canonical base58)
 * - signature: Ed25519 署名 (128-char hex or base64 encoding of 64 bytes)
 * - nonce: /challenge で発行したノンス (64-char lowercase hex)
 *
 * Rate limiting: withApiAuth 内の IP + key-based rate limit で保護済み。
 *
 * フロー:
 *   1. 署名を検証（消費前 — 失敗してもリトライ可能）
 *   2. consume_wallet_challenge RPC で challenge 消費 + profile 更新を原子的に実行
 *      (事前 SELECT 不要 — RPC が user_id+wallet+nonce で一意特定する)
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
    return apiError(
      API_ERRORS.BAD_REQUEST,
      parsed.error.issues.map((i) => i.message).join("; ")
    );
  }

  const { wallet: rawWallet, signature, nonce } = parsed.data;

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

  // Step 1: Verify Ed25519 signature BEFORE consuming the challenge.
  // This allows the user to retry with a corrected signature without losing the challenge.
  // 設計判断: DB 存在チェックより先に署名検証を行う。
  // 先に軽量 SELECT でチャレンジ存在確認する案もあるが、
  // それだと SELECT → 署名検証 → 消費 の 2 往復 + TOCTOU が発生する。
  // 署名検証は高コストだが、このエンドポイントは withApiAuth のレート制限で保護済み。
  // チャレンジ消費は Step 2 の RPC で原子的に行うため、署名失敗時もチャレンジは残る。
  const message = buildSiwsMessage({ wallet, userId: user.userId, nonce });

  const { valid: signatureValid, error: sigError } = verifyWalletSignature({ message, signature, wallet });
  if (sigError) {
    console.error("wallet/verify: signature decode/verify failed:", sigError);
    return apiError(API_ERRORS.BAD_REQUEST, "Failed to decode or verify signature");
  }

  if (!signatureValid) {
    return apiError(API_ERRORS.BAD_REQUEST, "Signature verification failed");
  }

  // Step 2: Atomically consume challenge + update profile via RPC.
  // The RPC locates the challenge by user_id+wallet+nonce (no pre-SELECT needed).
  // Returns a text result code instead of throwing to allow fine-grained error handling.
  const admin = getAdminClient();
  const { data: rpcResult, error: rpcError } = await admin.rpc(
    "consume_wallet_challenge",
    {
      p_nonce: nonce,
      p_user_id: user.userId,
      p_wallet: wallet,
    }
  );

  if (rpcError) {
    console.error("wallet/verify: RPC consume_wallet_challenge failed:", rpcError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  switch (rpcResult) {
    case "ok":
      return apiSuccess({ verified: true, wallet });

    case "not_found":
      return apiError(
        API_ERRORS.BAD_REQUEST,
        "Challenge not found, expired, or already used. Request a new challenge."
      );

    case "conflict_wallet":
      return apiError(
        API_ERRORS.CONFLICT,
        "This wallet address is already registered to another account"
      );

    case "user_not_found":
      console.error("wallet/verify: profile not found for user:", user.userId);
      return apiError(API_ERRORS.INTERNAL_ERROR, "Profile not found");

    default:
      console.error("wallet/verify: unexpected RPC result:", rpcResult);
      return apiError(API_ERRORS.INTERNAL_ERROR);
  }
}, { requiredPermissions: ["write"] });
