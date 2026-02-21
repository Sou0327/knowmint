import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getConnection } from "./connection";
import type { Token } from "@/types/database.types";

// USDC mint on mainnet / devnet
const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export function getUsdcMint(): PublicKey {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
  return network === "mainnet-beta" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
}

export async function buildSolTransfer(
  sender: PublicKey,
  recipient: string,
  amountSol: number
): Promise<Transaction> {
  const connection = getConnection();
  const recipientPubkey = new PublicKey(recipient);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: recipientPubkey,
      lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = sender;

  return transaction;
}

export function getPaymentAmount(
  priceSol: number | null,
  priceUsdc: number | null,
  token: Token
): number | null {
  switch (token) {
    case "SOL":
      return priceSol;
    case "USDC":
      return priceUsdc;
    default:
      return null;
  }
}
