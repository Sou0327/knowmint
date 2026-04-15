/**
 * Solana wallet address canonicalization helpers.
 *
 * Keeping this in a single module avoids subtle drift in the
 * "PublicKey parse + base58 round-trip" pattern that appears in auth flows,
 * server actions, and API routes. Pure functions — no network / env access.
 */
import { PublicKey } from "@solana/web3.js";

export type CanonicalWalletResult =
  | { ok: true; wallet: string }
  | { ok: false; error: "invalid_format" | "non_canonical" };

/**
 * Return the canonical base58 form of a Solana address.
 *
 * Fails closed when:
 *  - the input is not a valid base58 public key (`invalid_format`)
 *  - the input parses but re-encoding yields a different string, which
 *    indicates a non-canonical spelling (e.g. leading zero tricks).
 *    We reject rather than silently normalize so callers can treat the
 *    wallet as an untrusted identifier requiring exact equality.
 */
export function toCanonicalSolanaAddress(raw: string): CanonicalWalletResult {
  try {
    const canonical = new PublicKey(raw).toBase58();
    if (canonical !== raw) return { ok: false, error: "non_canonical" };
    return { ok: true, wallet: canonical };
  } catch {
    return { ok: false, error: "invalid_format" };
  }
}

/**
 * Convenience predicate for contexts where only a boolean check is needed
 * (e.g. env-var feature-flag guards). Does not enforce canonicality.
 */
export function isValidSolanaPublicKey(addr: string): boolean {
  try {
    new PublicKey(addr);
    return true;
  } catch {
    return false;
  }
}
