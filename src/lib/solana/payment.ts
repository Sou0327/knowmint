import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getConnection } from "./connection";

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
