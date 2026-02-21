import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getUsdcMint } from "./payment";
import { getFeeVault } from "./program";

export interface UsdcAccounts {
  buyerAta: PublicKey;
  sellerAta: PublicKey;
  feeVaultAta: PublicKey;
}

export async function resolveUsdcAccounts(
  buyer: PublicKey,
  sellerAddress: string
): Promise<UsdcAccounts> {
  const mint = getUsdcMint();
  const feeVault = getFeeVault();
  if (!feeVault) {
    throw new Error("Fee vault address is not configured");
  }
  const seller = new PublicKey(sellerAddress);

  return {
    buyerAta: getAssociatedTokenAddressSync(mint, buyer),
    sellerAta: getAssociatedTokenAddressSync(mint, seller),
    feeVaultAta: getAssociatedTokenAddressSync(mint, feeVault),
  };
}
