import type { TokenBalance } from "@solana/web3.js";
import type { Token } from "@/types/database.types";
import { getConnection } from "@/lib/solana/connection";
import { getUsdcMint } from "@/lib/solana/payment";

interface VerifySolanaPurchaseInput {
  txHash: string;
  token: Token;
  expectedRecipient: string;
  expectedAmount: number;
  expectedSender?: string;
  feeVaultAddress?: string;  // スマコンモード: split検証に使用
  programId?: string;        // スマコンモード: Program 実行を検証
}

/** tx の blockTime が現在から何秒以内かを要求する上限 */
const MAX_TX_AGE_SECONDS = 3600; // 1 hour

interface VerifyResult {
  valid: boolean;
  error?: string;
}

const SOLANA_TX_HASH_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

export function isValidSolanaTxHash(txHash: string): boolean {
  return SOLANA_TX_HASH_PATTERN.test(txHash);
}

function decimalToAtomic(amount: number, decimals: number): bigint {
  const fixed = amount.toFixed(decimals);
  const [whole, fraction = ""] = fixed.split(".");
  const normalized = `${whole}${fraction.padEnd(decimals, "0").slice(0, decimals)}`;
  return BigInt(normalized);
}

function getMessageAccountKeys(tx: {
  transaction: { message: unknown };
}): string[] {
  const message = tx.transaction.message as
    | { accountKeys?: Array<{ toBase58: () => string }> }
    | { staticAccountKeys?: Array<{ toBase58: () => string }> };

  let keys: Array<{ toBase58: () => string }> = [];
  if ("staticAccountKeys" in message && Array.isArray(message.staticAccountKeys)) {
    keys = message.staticAccountKeys;
  } else if ("accountKeys" in message && Array.isArray(message.accountKeys)) {
    keys = message.accountKeys;
  }

  return keys.map((key: { toBase58: () => string }) => key.toBase58());
}

/** スマコンモード: tx に指定 programId の instruction が含まれるか検証 */
function verifyProgramInvoked(
  tx: { transaction: { message: unknown } },
  accountKeys: string[],
  programId: string
): boolean {
  const message = tx.transaction.message as {
    compiledInstructions?: Array<{ programIdIndex: number }>;
    instructions?: Array<{ programIdIndex: number }>;
  };
  const instructions =
    message.compiledInstructions ??
    message.instructions ??
    [];
  return instructions.some((ix) => accountKeys[ix.programIdIndex] === programId);
}

function aggregateTokenBalanceByOwner(
  balances: TokenBalance[] | null | undefined,
  mint: string,
  owner: string
): { amount: bigint; found: boolean } {
  let amount = BigInt(0);
  let found = false;
  for (const balance of balances ?? []) {
    if (balance.mint !== mint || balance.owner !== owner) continue;
    found = true;
    amount += BigInt(balance.uiTokenAmount.amount);
  }
  return { amount, found };
}

function verifySolTransfer(
  tx: {
    meta: {
      preBalances: number[];
      postBalances: number[];
    };
  },
  accountKeys: string[],
  expectedRecipient: string,
  expectedAmount: number
): VerifyResult {
  const expectedLamports = decimalToAtomic(expectedAmount, 9);

  // 送信者 (payer = accountKeys[0]) の残高が expectedAmount 以上減少していること
  const senderPre = tx.meta.preBalances[0];
  const senderPost = tx.meta.postBalances[0];
  if (senderPre !== undefined && senderPost !== undefined) {
    const senderDecrease = BigInt(senderPre) - BigInt(senderPost);
    if (senderDecrease < expectedLamports) {
      return {
        valid: false,
        error: `SOL amount mismatch: sender balance did not decrease by expected amount`,
      };
    }
  }

  const recipientIdx = accountKeys.findIndex((key) => key === expectedRecipient);
  if (recipientIdx === -1) {
    return { valid: false, error: "Recipient wallet is not included in the transaction" };
  }

  const preBalance = tx.meta.preBalances[recipientIdx];
  const postBalance = tx.meta.postBalances[recipientIdx];
  if (preBalance === undefined || postBalance === undefined) {
    return { valid: false, error: "Unable to inspect recipient SOL balance changes" };
  }

  const receivedLamports = BigInt(postBalance) - BigInt(preBalance);
  if (receivedLamports < expectedLamports) {
    return {
      valid: false,
      error: `SOL amount mismatch: expected at least ${expectedAmount}, received ${Number(receivedLamports) / 1_000_000_000}`,
    };
  }

  return { valid: true };
}

function verifySolSplitTransfer(
  tx: {
    meta: {
      preBalances: number[];
      postBalances: number[];
    };
  },
  accountKeys: string[],
  expectedRecipient: string,
  expectedFeeVault: string,
  expectedAmount: number
): VerifyResult {
  const recipientIdx = accountKeys.findIndex((key) => key === expectedRecipient);
  if (recipientIdx === -1) {
    return { valid: false, error: "Recipient wallet is not included in the transaction" };
  }

  const feeVaultIdx = accountKeys.findIndex((key) => key === expectedFeeVault);
  if (feeVaultIdx === -1) {
    return { valid: false, error: "Fee vault is not included in the transaction" };
  }

  const expectedLamports = decimalToAtomic(expectedAmount, 9);

  // 送信者 (payer = accountKeys[0]) の残高が expectedAmount 以上減少していること
  const senderSplitPre = tx.meta.preBalances[0];
  const senderSplitPost = tx.meta.postBalances[0];
  if (senderSplitPre !== undefined && senderSplitPost !== undefined) {
    const senderDecrease = BigInt(senderSplitPre) - BigInt(senderSplitPost);
    if (senderDecrease < expectedLamports) {
      return {
        valid: false,
        error: `SOL amount mismatch: sender balance did not decrease by expected amount`,
      };
    }
  }

  // seller は 95% 以上受け取っていればOK
  const minSellerLamports = expectedLamports * BigInt(9500) / BigInt(10000);
  // fee vault は 5% 以上受け取っていればOK
  const minFeeLamports = expectedLamports * BigInt(500) / BigInt(10000);

  // ダスト金額で min が 0 になる場合は split 検証が無意味なため拒否
  if (minSellerLamports === BigInt(0) || minFeeLamports === BigInt(0)) {
    return { valid: false, error: "Amount is too small for split verification" };
  }

  const sellerPre = tx.meta.preBalances[recipientIdx];
  const sellerPost = tx.meta.postBalances[recipientIdx];
  if (sellerPre === undefined || sellerPost === undefined) {
    return { valid: false, error: "Unable to inspect seller SOL balance changes" };
  }

  const sellerReceived = BigInt(sellerPost) - BigInt(sellerPre);
  if (sellerReceived < minSellerLamports) {
    return {
      valid: false,
      error: `SOL split mismatch: seller received ${sellerReceived} lamports, expected at least ${minSellerLamports}`,
    };
  }

  const feePre = tx.meta.preBalances[feeVaultIdx];
  const feePost = tx.meta.postBalances[feeVaultIdx];
  if (feePre === undefined || feePost === undefined) {
    return { valid: false, error: "Unable to inspect fee vault SOL balance changes" };
  }

  const feeReceived = BigInt(feePost) - BigInt(feePre);
  if (feeReceived < minFeeLamports) {
    return {
      valid: false,
      error: `SOL split mismatch: fee vault received ${feeReceived} lamports, expected at least ${minFeeLamports}`,
    };
  }

  return { valid: true };
}

function verifyUsdcTransfer(
  tx: {
    meta: {
      preTokenBalances?: TokenBalance[] | null;
      postTokenBalances?: TokenBalance[] | null;
    };
  },
  expectedRecipient: string,
  expectedSender: string | undefined,
  expectedAmount: number
): VerifyResult {
  const mint = getUsdcMint().toBase58();
  const expectedAtomic = decimalToAtomic(expectedAmount, 6);

  const recipientPre = aggregateTokenBalanceByOwner(
    tx.meta.preTokenBalances,
    mint,
    expectedRecipient
  );
  const recipientPost = aggregateTokenBalanceByOwner(
    tx.meta.postTokenBalances,
    mint,
    expectedRecipient
  );

  if (!recipientPre.found && !recipientPost.found) {
    return {
      valid: false,
      error: "Recipient USDC token account was not found in transaction metadata",
    };
  }

  const received = recipientPost.amount - recipientPre.amount;
  if (received < expectedAtomic) {
    return {
      valid: false,
      error: "USDC amount mismatch for recipient",
    };
  }

  if (expectedSender) {
    const senderPre = aggregateTokenBalanceByOwner(
      tx.meta.preTokenBalances,
      mint,
      expectedSender
    );
    const senderPost = aggregateTokenBalanceByOwner(
      tx.meta.postTokenBalances,
      mint,
      expectedSender
    );
    if (!senderPre.found && !senderPost.found) {
      return {
        valid: false,
        error: "Sender USDC token account was not found in transaction metadata",
      };
    }
    const sent = senderPre.amount - senderPost.amount;
    if (sent < expectedAtomic) {
      return {
        valid: false,
        error: "USDC amount mismatch for sender",
      };
    }
  }

  return { valid: true };
}

function verifyUsdcSplitTransfer(
  tx: {
    meta: {
      preTokenBalances?: TokenBalance[] | null;
      postTokenBalances?: TokenBalance[] | null;
    };
  },
  expectedRecipient: string,
  expectedFeeVault: string,
  expectedAmount: number,
  expectedSender: string | undefined
): VerifyResult {
  const mint = getUsdcMint().toBase58();
  const expectedAtomic = decimalToAtomic(expectedAmount, 6);
  const minSellerAtomic = expectedAtomic * BigInt(9500) / BigInt(10000);
  const minFeeAtomic = expectedAtomic * BigInt(500) / BigInt(10000);

  // ダスト金額で min が 0 になる場合は split 検証が無意味なため拒否
  if (minSellerAtomic === BigInt(0) || minFeeAtomic === BigInt(0)) {
    return { valid: false, error: "Amount is too small for split verification" };
  }

  // 送信者の残高が全額以上減少していることを確認 (第三者送金による偽装を防止)
  if (expectedSender) {
    const senderPre = aggregateTokenBalanceByOwner(tx.meta.preTokenBalances, mint, expectedSender);
    const senderPost = aggregateTokenBalanceByOwner(tx.meta.postTokenBalances, mint, expectedSender);
    if (!senderPre.found && !senderPost.found) {
      return { valid: false, error: "Sender USDC token account was not found in transaction metadata" };
    }
    const sent = senderPre.amount - senderPost.amount;
    if (sent < expectedAtomic) {
      return { valid: false, error: "USDC amount mismatch for sender" };
    }
  }

  const recipientPre = aggregateTokenBalanceByOwner(tx.meta.preTokenBalances, mint, expectedRecipient);
  const recipientPost = aggregateTokenBalanceByOwner(tx.meta.postTokenBalances, mint, expectedRecipient);

  if (!recipientPre.found && !recipientPost.found) {
    return { valid: false, error: "Recipient USDC token account was not found in transaction metadata" };
  }

  const sellerReceived = recipientPost.amount - recipientPre.amount;
  if (sellerReceived < minSellerAtomic) {
    return { valid: false, error: "USDC split mismatch for seller" };
  }

  const feeVaultPre = aggregateTokenBalanceByOwner(tx.meta.preTokenBalances, mint, expectedFeeVault);
  const feeVaultPost = aggregateTokenBalanceByOwner(tx.meta.postTokenBalances, mint, expectedFeeVault);

  if (!feeVaultPre.found && !feeVaultPost.found) {
    return { valid: false, error: "Fee vault USDC token account was not found in transaction metadata" };
  }

  const feeReceived = feeVaultPost.amount - feeVaultPre.amount;
  if (feeReceived < minFeeAtomic) {
    return { valid: false, error: "USDC split mismatch for fee vault" };
  }

  return { valid: true };
}

export async function verifySolanaPurchaseTransaction(
  input: VerifySolanaPurchaseInput
): Promise<VerifyResult> {
  if (!isValidSolanaTxHash(input.txHash)) {
    return { valid: false, error: "Invalid Solana transaction hash format" };
  }

  if (input.expectedAmount <= 0) {
    return { valid: false, error: "Expected amount must be positive" };
  }

  if (input.token !== "SOL" && input.token !== "USDC") {
    return { valid: false, error: "Only SOL and USDC are supported on Solana" };
  }

  const connection = getConnection();

  try {
    const { value: statuses } = await connection.getSignatureStatuses(
      [input.txHash],
      { searchTransactionHistory: true }
    );
    const status = statuses[0];

    if (!status) {
      return { valid: false, error: "Transaction status was not found on-chain" };
    }

    if (status.err) {
      return { valid: false, error: "Transaction failed on-chain" };
    }

    if (
      status.confirmationStatus !== "confirmed" &&
      status.confirmationStatus !== "finalized"
    ) {
      return { valid: false, error: "Transaction is not confirmed yet" };
    }

    const tx = await connection.getTransaction(input.txHash, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta) {
      return { valid: false, error: "Transaction details are unavailable" };
    }

    if (tx.meta.err) {
      return { valid: false, error: "Transaction metadata indicates failure" };
    }

    // blockTime 鮮度チェック — 古い tx の再利用 (リプレイ) を防止
    // blockTime が null の場合は fail-closed (安全側) で拒否
    if (tx.blockTime === null || tx.blockTime === undefined) {
      return { valid: false, error: "Transaction block time is unavailable" };
    }
    const ageSecs = Math.floor(Date.now() / 1000) - tx.blockTime;
    if (ageSecs > MAX_TX_AGE_SECONDS) {
      return { valid: false, error: "Transaction is too old" };
    }

    const accountKeys = getMessageAccountKeys(tx);
    if (input.expectedSender && accountKeys[0] !== input.expectedSender) {
      return { valid: false, error: "Sender wallet does not match transaction payer" };
    }

    // スマコンモード: 指定 Program が実際に呼ばれたことを検証
    // 設計上の判断: instruction data (amount / accounts) のパースは行わず、
    // 代わりに「送信者が expectedAmount 以上支払った」+「受取側が 95/5 以上受け取った」
    // の残高差分検証で等価のアウトカムを保証する。
    // 攻撃者が program 呼び出しに偽 amount を使っても sender check で防がれる。
    if (input.feeVaultAddress && input.programId) {
      if (!verifyProgramInvoked(tx, accountKeys, input.programId)) {
        return { valid: false, error: "Expected smart contract program was not invoked in this transaction" };
      }
    }

    if (input.token === "SOL") {
      if (input.feeVaultAddress) {
        return verifySolSplitTransfer(
          tx as {
            meta: {
              preBalances: number[];
              postBalances: number[];
            };
          },
          accountKeys,
          input.expectedRecipient,
          input.feeVaultAddress,
          input.expectedAmount
        );
      }
      return verifySolTransfer(
        tx as {
          meta: {
            preBalances: number[];
            postBalances: number[];
          };
        },
        accountKeys,
        input.expectedRecipient,
        input.expectedAmount
      );
    }

    if (input.feeVaultAddress) {
      return verifyUsdcSplitTransfer(
        tx as {
          meta: {
            preTokenBalances?: TokenBalance[] | null;
            postTokenBalances?: TokenBalance[] | null;
          };
        },
        input.expectedRecipient,
        input.feeVaultAddress,
        input.expectedAmount,
        input.expectedSender
      );
    }

    return verifyUsdcTransfer(
      tx as {
        meta: {
          preTokenBalances?: TokenBalance[] | null;
          postTokenBalances?: TokenBalance[] | null;
        };
      },
      input.expectedRecipient,
      input.expectedSender,
      input.expectedAmount
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown verification error";
    return { valid: false, error: message };
  }
}
