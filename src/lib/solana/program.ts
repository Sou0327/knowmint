import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getConnection } from "./connection";
import type { AccountMeta } from "@solana/web3.js";

export const PROTOCOL_FEE_BPS = 500;

// Anchor discriminators (pre-computed, sha256("global:<method>")[0..8])
// execute_purchase: sha256("global:execute_purchase")[0..8]
const EXECUTE_PURCHASE_DISCRIMINATOR = new Uint8Array([193, 193, 250, 92, 23, 221, 96, 102]);

export function getProgramId(): PublicKey | null {
  const id = process.env.NEXT_PUBLIC_KM_PROGRAM_ID;
  if (!id) return null;
  try {
    return new PublicKey(id);
  } catch {
    return null;
  }
}

export function getFeeVault(): PublicKey | null {
  const addr = process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS;
  if (!addr) return null;
  try {
    return new PublicKey(addr);
  } catch {
    return null;
  }
}

export function isSmartContractEnabled(): boolean {
  return getProgramId() !== null && getFeeVault() !== null;
}

export async function buildSmartContractPurchase(
  buyer: PublicKey,
  sellerAddress: string,
  amountSol: number
): Promise<Transaction> {
  const programId = getProgramId();
  const feeVault = getFeeVault();
  if (!programId || !feeVault) {
    throw new Error("Smart contract is not configured");
  }

  const seller = new PublicKey(sellerAddress);

  // instruction data: discriminator(8B) + amount_u64_LE(8B)
  const data = Buffer.alloc(16);
  data.set(EXECUTE_PURCHASE_DISCRIMINATOR, 0);
  const lamports = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
  data.writeBigUInt64LE(lamports, 8);

  const keys: AccountMeta[] = [
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: seller, isSigner: false, isWritable: true },
    { pubkey: feeVault, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId,
    data,
  });

  const connection = getConnection();
  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = buyer;

  return transaction;
}

