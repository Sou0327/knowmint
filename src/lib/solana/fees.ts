/**
 * Protocol fee calculation helpers.
 *
 * The on-chain program splits payments 95%/5% between seller and fee-vault.
 * This module centralizes the fee math so the UI, server actions, and the
 * purchase route stay in sync. All math is done in atomic units (lamports
 * for SOL, 1e-6 USDC) to avoid float drift, then converted back to decimal.
 */

export type FeeToken = "SOL" | "USDC";

const PROTOCOL_FEE_BPS = 500; // 5.00%
const BPS_DENOMINATOR = 10_000;

/** Atomic-unit decimal count for each supported fee token. */
export function getTokenDecimals(token: FeeToken): number {
  return token === "USDC" ? 6 : 9;
}

/**
 * Compute the protocol fee charged on an on-chain payment.
 *
 * - When `hasFeeVault` is false (e.g. smart contract not yet deployed), no
 *   fee is withheld and this returns 0.
 * - Fee is computed in atomic units (floor → seller gets the larger share)
 *   so the return value is safe to pass to downstream code that quantizes
 *   to the token's native decimals.
 */
export function computeProtocolFee(
  amount: number,
  token: FeeToken,
  hasFeeVault: boolean,
): number {
  if (!hasFeeVault) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const decimals = getTokenDecimals(token);
  const scale = 10 ** decimals;
  const atomicTotal = Math.round(amount * scale);
  const sellerAtomic = Math.floor(
    (atomicTotal * (BPS_DENOMINATOR - PROTOCOL_FEE_BPS)) / BPS_DENOMINATOR,
  );
  const feeAtomic = atomicTotal - sellerAtomic;
  return feeAtomic / scale;
}
