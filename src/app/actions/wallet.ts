"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildSiwsMessage } from "@/lib/siws/message";
import { randomBytes } from "crypto";
import { PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";

/**
 * SIWS チャレンジ発行 Server Action
 * セッション認証ベース (Supabase cookie session) — ブラウザ UI 用
 */
export async function requestWalletChallenge(
  walletAddress: string
): Promise<{ success: true; nonce: string; message: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "認証が必要です" };
  }

  // Canonical wallet validation
  let wallet: string;
  try {
    wallet = new PublicKey(walletAddress).toBase58();
  } catch {
    return { success: false, error: "Invalid Solana wallet address" };
  }
  if (wallet !== walletAddress) {
    return { success: false, error: "Wallet address must be in canonical base58 format" };
  }

  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const admin = getAdminClient();
  const { error: upsertError } = await admin
    .from("wallet_challenges")
    .upsert(
      { user_id: user.id, wallet, nonce, expires_at: expiresAt },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("[wallet action] challenge upsert failed:", upsertError);
    return { success: false, error: "チャレンジの生成に失敗しました" };
  }

  const message = buildSiwsMessage({ wallet, userId: user.id, nonce });
  return { success: true, nonce, message };
}

/**
 * SIWS 署名検証 Server Action
 * セッション認証ベース (Supabase cookie session) — ブラウザ UI 用
 */
export async function verifyWalletSignature(
  walletAddress: string,
  signatureBase64: string,
  nonce: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "認証が必要です" };
  }

  // Canonical wallet validation
  let wallet: string;
  try {
    wallet = new PublicKey(walletAddress).toBase58();
  } catch {
    return { success: false, error: "Invalid Solana wallet address" };
  }
  if (wallet !== walletAddress) {
    return { success: false, error: "Wallet address must be in canonical base58 format" };
  }

  // nonce format validation
  if (!/^[0-9a-f]{64}$/.test(nonce)) {
    return { success: false, error: "Invalid nonce format" };
  }

  // Ed25519 署名検証
  const message = buildSiwsMessage({ wallet, userId: user.id, nonce });
  try {
    const messageBytes = new TextEncoder().encode(message);
    // base64 → 64 bytes
    const sigBuf = Buffer.from(signatureBase64, "base64");
    if (sigBuf.length !== 64) {
      return { success: false, error: "Signature must decode to 64 bytes" };
    }
    if (sigBuf.toString("base64") !== signatureBase64) {
      return { success: false, error: "Non-canonical base64 encoding" };
    }
    const sigBytes = new Uint8Array(sigBuf);
    const pubkeyBytes = new PublicKey(wallet).toBytes();
    const valid = ed25519.verify(sigBytes, messageBytes, pubkeyBytes);
    if (!valid) {
      return { success: false, error: "署名の検証に失敗しました" };
    }
  } catch (err) {
    console.error("[wallet action] signature verify failed:", err);
    return { success: false, error: "署名の検証に失敗しました" };
  }

  // Atomically consume challenge + update profile via RPC
  const admin = getAdminClient();
  const { data: rpcResult, error: rpcError } = await admin.rpc("consume_wallet_challenge", {
    p_nonce: nonce,
    p_user_id: user.id,
    p_wallet: wallet,
  });

  if (rpcError) {
    console.error("[wallet action] consume_wallet_challenge RPC failed:", rpcError);
    return { success: false, error: "ウォレット登録に失敗しました" };
  }

  switch (rpcResult) {
    case "ok":
      return { success: true };
    case "not_found":
      return { success: false, error: "チャレンジが見つかりません。再度ウォレットを接続してください。" };
    case "conflict_wallet":
      return { success: false, error: "このウォレットアドレスは既に別のアカウントで使用されています" };
    case "user_not_found":
      console.error("[wallet action] profile not found for user:", user.id);
      return { success: false, error: "プロフィールが見つかりません" };
    default:
      console.error("[wallet action] unexpected RPC result:", rpcResult);
      return { success: false, error: "予期しないエラーが発生しました" };
  }
}
