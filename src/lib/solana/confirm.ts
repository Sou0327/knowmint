import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getConnection } from "./connection";

export async function confirmTransaction(
  txHash: string
): Promise<{ confirmed: boolean; error?: string }> {
  const connection = getConnection();

  try {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const result = await connection.confirmTransaction(
      {
        signature: txHash,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed"
    );

    if (result.value.err) {
      return {
        confirmed: false,
        error: `Transaction failed: ${JSON.stringify(result.value.err)}`,
      };
    }

    return { confirmed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timeout") || message.includes("expired")) {
      return { confirmed: false, error: "Transaction confirmation timed out" };
    }
    return { confirmed: false, error: message };
  }
}

// オンチェーンでトランザクション詳細を検証
export async function verifyTransactionDetails(
  txHash: string,
  expectedRecipient: string,
  expectedAmountSol: number,
  expectedSender: string
): Promise<{ valid: boolean; error?: string }> {
  const connection = getConnection();

  try {
    const tx = await connection.getTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta) {
      return { valid: false, error: "トランザクションが見つかりません" };
    }

    if (tx.meta.err) {
      return { valid: false, error: "トランザクションが失敗しています" };
    }

    const accountKeys = tx.transaction.message.getAccountKeys();
    const senderKey = accountKeys.get(0);
    if (!senderKey || senderKey.toBase58() !== expectedSender) {
      return { valid: false, error: "送信者が一致しません" };
    }

    // SOL転送: pre/postBalances の差分で金額を検証
    const recipientIndex = accountKeys.length;
    let recipientIdx = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys.get(i);
      if (key && key.toBase58() === expectedRecipient) {
        recipientIdx = i;
        break;
      }
    }

    if (recipientIdx === -1) {
      return { valid: false, error: "受取人がトランザクションに含まれていません" };
    }

    const preBalance = tx.meta.preBalances[recipientIdx] ?? 0;
    const postBalance = tx.meta.postBalances[recipientIdx] ?? 0;
    const receivedLamports = postBalance - preBalance;
    const expectedLamports = Math.round(expectedAmountSol * LAMPORTS_PER_SOL);

    // 1%の許容誤差（手数料考慮）
    if (receivedLamports < expectedLamports * 0.99) {
      return {
        valid: false,
        error: `金額不一致: 期待=${expectedAmountSol} SOL, 受取=${receivedLamports / LAMPORTS_PER_SOL} SOL`,
      };
    }

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: message };
  }
}
