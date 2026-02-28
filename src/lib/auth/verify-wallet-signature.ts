import { ed25519 } from "@noble/curves/ed25519";
import { PublicKey } from "@solana/web3.js";

/** hex 文字列 → Uint8Array (Buffer 不使用) */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Ed25519 署名を hex (128 chars) または base64 (64 bytes → 88 chars) からデコード。
 * 不正なフォーマットは Error を throw。
 * Buffer 非依存 — CF Workers / Node.js 両対応。
 */
export function decodeSignature(sig: string): Uint8Array {
  if (/^[0-9a-fA-F]{128}$/.test(sig)) {
    return hexToBytes(sig);
  }
  // base64: 64 bytes → 88 chars with == padding
  let binaryStr: string;
  try {
    binaryStr = atob(sig);
  } catch {
    throw new Error("Invalid base64 encoding");
  }
  if (binaryStr.length !== 64) throw new Error("Signature must decode to 64 bytes");
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  // canonical base64 チェック
  if (btoa(String.fromCharCode(...bytes)) !== sig)
    throw new Error("Non-canonical base64 encoding");
  return bytes;
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
