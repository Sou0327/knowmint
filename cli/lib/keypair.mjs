import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ed25519 } from "@noble/curves/ed25519";

const DEFAULT_KEYPAIR_PATH = path.join(os.homedir(), ".km", "keypair.json");

/**
 * Keypair ファイルを読み込む。存在しなければ新規生成して保存する (0o600)。
 * Solana CLI 標準形式: 64 bytes JSON 配列 (前半 32 = secret key, 後半 32 = public key)
 *
 * @param {string} [keypairPath] - keypair ファイルパス (省略時 ~/.km/keypair.json)
 * @returns {Promise<{ secretKey: Uint8Array, publicKeyBytes: Uint8Array, wallet: string }>}
 */
export async function loadOrCreateKeypair(keypairPath) {
  const filePath = keypairPath || DEFAULT_KEYPAIR_PATH;
  let raw;

  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;

    // 新規生成
    const privKey = ed25519.utils.randomPrivateKey();
    const pubKey = ed25519.getPublicKey(privKey);
    const combined = new Uint8Array(64);
    combined.set(privKey, 0);
    combined.set(pubKey, 32);

    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(filePath, JSON.stringify(Array.from(combined)), {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.chmod(dir, 0o700);
    await fs.chmod(filePath, 0o600);

    console.log(`New keypair generated: ${filePath}`);

    return {
      secretKey: privKey,
      publicKeyBytes: pubKey,
      wallet: encodeBase58(pubKey),
    };
  }

  // 既存ファイル読み込み
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error(`Invalid keypair file (expected 64-byte JSON array): ${filePath}`);
  }
  // 各要素が 0..255 の整数であることを検証
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 255) {
      throw new Error(`Invalid byte at index ${i} in keypair file: ${filePath}`);
    }
  }

  const bytes = new Uint8Array(arr);
  const secretKey = bytes.slice(0, 32);
  const publicKeyBytes = bytes.slice(32, 64);

  // secret key から導出した public key と格納値の整合性を検証
  const derivedPub = ed25519.getPublicKey(secretKey);
  if (encodeBase58(derivedPub) !== encodeBase58(publicKeyBytes)) {
    throw new Error(`Keypair integrity check failed (public key mismatch): ${filePath}`);
  }

  // ファイル権限チェック (UNIX 系のみ)
  try {
    const stat = await fs.stat(filePath);
    const mode = stat.mode & 0o777;
    if (mode !== 0o600) {
      console.warn(
        `Warning: keypair file ${filePath} has permissions ${mode.toString(8)}. Fixing to 0600.`
      );
      await fs.chmod(filePath, 0o600);
    }
  } catch {
    // 権限チェック失敗は非致命的
  }

  return {
    secretKey,
    publicKeyBytes,
    wallet: encodeBase58(publicKeyBytes),
  };
}

/**
 * Ed25519 署名を生成して hex 文字列で返す。
 *
 * @param {Uint8Array} secretKey - 32-byte secret key
 * @param {string} message - 署名対象メッセージ
 * @returns {string} hex-encoded signature (128 chars)
 */
export function signMessage(secretKey, message) {
  const messageBytes = new TextEncoder().encode(message);
  const sigBytes = ed25519.sign(messageBytes, secretKey);
  return Buffer.from(sigBytes).toString("hex");
}

// ── Base58 encoder (minimal, no external deps) ────────────────────────────
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes) {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = "";
  for (const byte of bytes) {
    if (byte === 0) str += "1";
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    str += BASE58_ALPHABET[digits[i]];
  }
  return str;
}
