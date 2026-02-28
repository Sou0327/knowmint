import { ed25519 } from "@noble/curves/ed25519";
import { PublicKey } from "@solana/web3.js";

/**
 * Ed25519 署名を hex (128 chars) または base64 (64 bytes → 88 chars) からデコード。
 * 不正なフォーマットは Error を throw。
 */
export function decodeSignature(sig: string): Uint8Array {
  if (/^[0-9a-fA-F]{128}$/.test(sig)) {
    return new Uint8Array(Buffer.from(sig, "hex"));
  }
  // base64: 64 bytes → 88 chars with == padding
  const buf = Buffer.from(sig, "base64");
  if (buf.length !== 64) throw new Error("Signature must decode to 64 bytes");
  if (buf.toString("base64") !== sig)
    throw new Error("Non-canonical base64 encoding");
  return new Uint8Array(buf);
}

/**
 * Ed25519 署名を検証する共通ヘルパー。
 *
 * @returns valid: true で検証成功、false で失敗。error はデコード/検証エラー時のメッセージ。
 */
export function verifyWalletSignature(params: {
  message: string;
  signature: string;
  wallet: string;
}): { valid: boolean; error?: string } {
  try {
    const messageBytes = new TextEncoder().encode(params.message);
    const sigBytes = decodeSignature(params.signature);
    const pubkeyBytes = new PublicKey(params.wallet).toBytes();
    const valid = ed25519.verify(sigBytes, messageBytes, pubkeyBytes);
    return { valid };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
