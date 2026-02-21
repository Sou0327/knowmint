import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16; // 128-bit auth tag

function getSigningKey(): Buffer {
  const keyHex = process.env.WEBHOOK_SIGNING_KEY;
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "WEBHOOK_SIGNING_KEY must be a 64-character hex string (32 bytes). " +
        "Generate with: openssl rand -hex 32"
    );
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("WEBHOOK_SIGNING_KEY decoded to unexpected length");
  }
  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a string in the format: `${ivHex}.${ciphertextHex}.${tagHex}`
 */
export function encryptSecret(plaintext: string): string {
  const key = getSigningKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}.${encrypted.toString("hex")}.${tag.toString("hex")}`;
}

/**
 * Decrypt a string previously encrypted with encryptSecret.
 * Expects format: `${ivHex}.${ciphertextHex}.${tagHex}`
 */
export function decryptSecret(encrypted: string): string {
  const key = getSigningKey();
  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [ivHex, dataHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Invalid encrypted secret: malformed IV or tag");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}
