import { vi, expect, describe, it, beforeEach } from "vitest";
import { PublicKey } from "@solana/web3.js";

const BUYER_ADDR = "BuyerAddr11111111111111111111111111111111111";
const SELLER_ADDR = "SellerAddr1111111111111111111111111111111111";
const VALID_TX_HASH = "A".repeat(87);
const FEE_VAULT_ADDR = "FeeVaultAddr11111111111111111111111111111111";

// -----------------------------------------------------------------------
// Mutable mock state (hoisted so mock factories can access it)
// -----------------------------------------------------------------------
const mockState = vi.hoisted(() => ({
  status: {
    err: null as unknown,
    confirmationStatus: "finalized",
    slot: 100,
    confirmations: 10,
  } as {
    err: unknown;
    confirmationStatus: string;
    slot: number;
    confirmations: number;
  } | null,
  tx: null as unknown,
  getStatusesThrows: false,
}));

vi.mock("@/lib/solana/connection", () => ({
  getConnection: () => ({
    getSignatureStatuses: async (_hashes: string[]) => {
      if (mockState.getStatusesThrows) throw new Error("RPC network error");
      return { value: [mockState.status] };
    },
    getTransaction: async (_hash: string, _opts: unknown) => mockState.tx,
  }),
}));

// Note: getUsdcMint is now defined locally in verify-transaction.ts, no payment.ts mock needed

import { verifySolanaPurchaseTransaction, isValidSolanaTxHash } from "@/lib/solana/verify-transaction";

function buildDefaultTx() {
  return {
    blockTime: Math.floor(Date.now() / 1000) - 60,
    meta: {
      err: null,
      preBalances: [2_000_000_000, 0, 0],
      postBalances: [1_900_000_000, 100_000_000, 0],
      preTokenBalances: [],
      postTokenBalances: [],
    },
    transaction: {
      message: {
        staticAccountKeys: [
          { toBase58: () => BUYER_ADDR },
          { toBase58: () => SELLER_ADDR },
        ],
      },
    },
  };
}

// -----------------------------------------------------------------------
// isValidSolanaTxHash()
// -----------------------------------------------------------------------
describe("isValidSolanaTxHash()", () => {
  it('87文字 base58 → true ("A".repeat(87))', () => {
    expect(isValidSolanaTxHash("A".repeat(87))).toBeTruthy();
  });

  it('88文字 base58 → true ("A".repeat(88))', () => {
    expect(isValidSolanaTxHash("A".repeat(88))).toBeTruthy();
  });

  it("86文字 → false", () => {
    expect(isValidSolanaTxHash("A".repeat(86))).toBeFalsy();
  });

  it("base58禁止文字 '0' を含む → false", () => {
    const s = "0" + "A".repeat(86);
    expect(isValidSolanaTxHash(s)).toBeFalsy();
  });

  it("base58禁止文字 'O' を含む → false", () => {
    const s = "O" + "A".repeat(86);
    expect(isValidSolanaTxHash(s)).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — 早期バリデーション
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — 早期バリデーション", () => {
  it("無効 txHash 形式（86文字） → { valid:false, error: 'Invalid Solana transaction hash format' }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: "A".repeat(86),
      token: "SOL",
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1,
    });
    expect(result.valid).toBeFalsy();
    expect(result.error).toBe("Invalid Solana transaction hash format");
  });

  it("expectedAmount = 0 → { valid:false }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL",
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0,
    });
    expect(result.valid).toBeFalsy();
  });

  it("token = 'ETH' (unsupported) → { valid:false }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "ETH" as "SOL",
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1,
    });
    expect(result.valid).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — オンチェーン状態チェック
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — オンチェーン状態チェック", () => {
  const defaultInput = {
    txHash: VALID_TX_HASH,
    token: "SOL" as const,
    expectedRecipient: SELLER_ADDR,
    expectedAmount: 0.1,
  };

  beforeEach(() => {
    mockState.status = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockState.tx = buildDefaultTx();
    mockState.getStatusesThrows = false;
  });

  it("getSignatureStatuses が { value: [null] } を返す → { valid:false }", async () => {
    mockState.status = null;
    const result = await verifySolanaPurchaseTransaction(defaultInput);
    expect(result.valid).toBeFalsy();
  });

  it("status.err != null → { valid:false }", async () => {
    mockState.status = {
      err: new Error("on-chain error"),
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    const result = await verifySolanaPurchaseTransaction(defaultInput);
    expect(result.valid).toBeFalsy();
  });

  it("confirmationStatus = 'processed' → { valid:false }", async () => {
    mockState.status = {
      err: null,
      confirmationStatus: "processed",
      slot: 100,
      confirmations: 10,
    };
    const result = await verifySolanaPurchaseTransaction(defaultInput);
    expect(result.valid).toBeFalsy();
  });

  it("getTransaction が null を返す → { valid:false }", async () => {
    mockState.tx = null;
    const result = await verifySolanaPurchaseTransaction(defaultInput);
    expect(result.valid).toBeFalsy();
  });

  it("blockTime が現在から 86401 秒以上前 (24h超) → { valid:false }", async () => {
    mockState.tx = {
      ...(buildDefaultTx()),
      blockTime: Math.floor(Date.now() / 1000) - 86401,
    };
    const result = await verifySolanaPurchaseTransaction(defaultInput);
    expect(result.valid).toBeFalsy();
  });

  it("blockTime が未来 (61秒以上先) → { valid:false }", async () => {
    mockState.tx = {
      ...(buildDefaultTx()),
      blockTime: Math.floor(Date.now() / 1000) + 120,
    };
    const result = await verifySolanaPurchaseTransaction(defaultInput);
    expect(result.valid).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — 送信者チェック
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — 送信者チェック", () => {
  beforeEach(() => {
    mockState.status = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockState.tx = buildDefaultTx();
    mockState.getStatusesThrows = false;
  });

  it("accountKeys[0] !== expectedSender → { valid:false }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.1,
      expectedSender: "OtherAddr1111111111111111111111111111111111",
    });
    expect(result.valid).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — SOL 転送検証
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — SOL 転送検証", () => {
  beforeEach(() => {
    mockState.status = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockState.tx = buildDefaultTx();
    mockState.getStatusesThrows = false;
  });

  it("正常 SOL 転送 → { valid:true }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.1,
    });
    expect(result.valid).toBeTruthy();
  });

  it("recipient が accountKeys に存在しない → { valid:false }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: "DifferentAddr111111111111111111111111111111",
      expectedAmount: 0.1,
    });
    expect(result.valid).toBeFalsy();
  });

  it("recipient 残高差分不足 → { valid:false }", async () => {
    mockState.tx = {
      ...(buildDefaultTx()),
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0, 0],
        postBalances: [1_950_000_000, 50_000_000, 0],
        preTokenBalances: [],
        postTokenBalances: [],
      },
    };
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.1,
    });
    expect(result.valid).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — SOL split 検証 (feeVaultあり)
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — SOL split 検証 (feeVaultあり)", () => {
  function buildSplitTx() {
    return {
      blockTime: Math.floor(Date.now() / 1000) - 60,
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0, 0, 0],
        postBalances: [1_000_000_000, 950_000_000, 0, 50_000_000],
        preTokenBalances: [],
        postTokenBalances: [],
      },
      transaction: {
        message: {
          staticAccountKeys: [
            { toBase58: () => BUYER_ADDR },
            { toBase58: () => SELLER_ADDR },
            { toBase58: () => "Dummy111111111111111111111111111111111111111" },
            { toBase58: () => FEE_VAULT_ADDR },
          ],
        },
      },
    };
  }

  beforeEach(() => {
    mockState.status = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockState.tx = buildSplitTx();
    mockState.getStatusesThrows = false;
  });

  it("seller 95% + fee 5% 正常 → { valid:true }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    expect(result.valid).toBeTruthy();
  });

  it("seller 受取 < 95% (seller postBalance = 900_000_000) → { valid:false }", async () => {
    mockState.tx = {
      ...buildSplitTx(),
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0, 0, 0],
        postBalances: [1_000_000_000, 900_000_000, 0, 50_000_000],
        preTokenBalances: [],
        postTokenBalances: [],
      },
    };
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    expect(result.valid).toBeFalsy();
  });

  it("ダスト金額 (expectedAmount = 0.000000001 SOL → minSellerLamports = 0 になる) → { valid:false }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.000000001,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    expect(result.valid).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — USDC 転送検証
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — USDC 転送検証", () => {
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  function buildUsdcTx(recipientAmount: string, senderDecrement: string) {
    return {
      blockTime: Math.floor(Date.now() / 1000) - 60,
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0],
        postBalances: [1_995_000_000, 0],
        preTokenBalances: [
          {
            mint: USDC_MINT,
            owner: BUYER_ADDR,
            uiTokenAmount: { amount: senderDecrement, decimals: 6, uiAmount: null },
          },
        ],
        postTokenBalances: [
          {
            mint: USDC_MINT,
            owner: SELLER_ADDR,
            uiTokenAmount: { amount: recipientAmount, decimals: 6, uiAmount: null },
          },
          {
            mint: USDC_MINT,
            owner: BUYER_ADDR,
            uiTokenAmount: { amount: "0", decimals: 6, uiAmount: null },
          },
        ],
      },
      transaction: {
        message: {
          staticAccountKeys: [
            { toBase58: () => BUYER_ADDR },
            { toBase58: () => SELLER_ADDR },
          ],
        },
      },
    };
  }

  beforeEach(() => {
    mockState.status = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockState.getStatusesThrows = false;
  });

  it("正常 USDC 転送 (recipient +1 USDC) → { valid:true }", async () => {
    mockState.tx = buildUsdcTx("1000000", "1000000");
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
    });
    expect(result.valid).toBeTruthy();
  });

  it("USDC 受取金額不足 (recipient +0.5 USDC, expected 1 USDC) → { valid:false }", async () => {
    mockState.tx = buildUsdcTx("500000", "500000");
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
    });
    expect(result.valid).toBeFalsy();
  });

  it("recipient の USDC トークンアカウントが存在しない → { valid:false }", async () => {
    mockState.tx = {
      blockTime: Math.floor(Date.now() / 1000) - 60,
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0],
        postBalances: [1_995_000_000, 0],
        preTokenBalances: [],
        postTokenBalances: [],
      },
      transaction: {
        message: {
          staticAccountKeys: [
            { toBase58: () => BUYER_ADDR },
            { toBase58: () => SELLER_ADDR },
          ],
        },
      },
    };
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
    });
    expect(result.valid).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — USDC split 検証 (feeVaultあり)
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — USDC split 検証 (feeVaultあり)", () => {
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  function buildUsdcSplitTx(
    sellerAmount: string,
    feeVaultAmount: string,
    senderDecrement: string
  ) {
    return {
      blockTime: Math.floor(Date.now() / 1000) - 60,
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0, 0],
        postBalances: [1_995_000_000, 0, 0],
        preTokenBalances: [
          {
            mint: USDC_MINT,
            owner: BUYER_ADDR,
            uiTokenAmount: { amount: senderDecrement, decimals: 6, uiAmount: null },
          },
        ],
        postTokenBalances: [
          {
            mint: USDC_MINT,
            owner: SELLER_ADDR,
            uiTokenAmount: { amount: sellerAmount, decimals: 6, uiAmount: null },
          },
          {
            mint: USDC_MINT,
            owner: FEE_VAULT_ADDR,
            uiTokenAmount: { amount: feeVaultAmount, decimals: 6, uiAmount: null },
          },
          {
            mint: USDC_MINT,
            owner: BUYER_ADDR,
            uiTokenAmount: { amount: "0", decimals: 6, uiAmount: null },
          },
        ],
      },
      transaction: {
        message: {
          staticAccountKeys: [
            { toBase58: () => BUYER_ADDR },
            { toBase58: () => SELLER_ADDR },
            { toBase58: () => FEE_VAULT_ADDR },
          ],
        },
      },
    };
  }

  beforeEach(() => {
    mockState.status = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockState.getStatusesThrows = false;
  });

  it("USDC split: seller 95% + feeVault 5% 正常 → { valid:true }", async () => {
    mockState.tx = buildUsdcSplitTx("950000", "50000", "1000000");
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    expect(result.valid).toBeTruthy();
  });

  it("USDC split: seller 受取 < 95% → { valid:false }", async () => {
    mockState.tx = buildUsdcSplitTx("800000", "50000", "1000000");
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    expect(result.valid).toBeFalsy();
  });

  it("USDC split: feeVault 受取 < 5% → { valid:false }", async () => {
    mockState.tx = buildUsdcSplitTx("950000", "10000", "1000000");
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    expect(result.valid).toBeFalsy();
  });

  it("USDC split: sender 送付額不足（偽装送金）→ { valid:false }", async () => {
    mockState.tx = {
      blockTime: Math.floor(Date.now() / 1000) - 60,
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0, 0],
        postBalances: [1_995_000_000, 0, 0],
        preTokenBalances: [
          {
            mint: USDC_MINT,
            owner: BUYER_ADDR,
            uiTokenAmount: { amount: "1000000", decimals: 6, uiAmount: null },
          },
        ],
        postTokenBalances: [
          {
            mint: USDC_MINT,
            owner: SELLER_ADDR,
            uiTokenAmount: { amount: "950000", decimals: 6, uiAmount: null },
          },
          {
            mint: USDC_MINT,
            owner: FEE_VAULT_ADDR,
            uiTokenAmount: { amount: "50000", decimals: 6, uiAmount: null },
          },
          {
            mint: USDC_MINT,
            owner: BUYER_ADDR,
            uiTokenAmount: { amount: "500000", decimals: 6, uiAmount: null },
          },
        ],
      },
      transaction: {
        message: {
          staticAccountKeys: [
            { toBase58: () => BUYER_ADDR },
            { toBase58: () => SELLER_ADDR },
            { toBase58: () => FEE_VAULT_ADDR },
          ],
        },
      },
    };
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    expect(result.valid).toBeFalsy();
  });

  it("USDC split: ダスト金額 (minSellerAtomic = 0) → { valid:false }", async () => {
    mockState.tx = buildUsdcSplitTx("0", "0", "1");
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.000001,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    expect(result.valid).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — programId 分岐検証
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — programId 分岐検証", () => {
  const PROGRAM_ID = "Prog1111111111111111111111111111111111111111";

  beforeEach(() => {
    mockState.status = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockState.tx = {
      blockTime: Math.floor(Date.now() / 1000) - 60,
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0, 0, 0],
        postBalances: [1_000_000_000, 950_000_000, 0, 50_000_000],
        preTokenBalances: [],
        postTokenBalances: [],
      },
      transaction: {
        message: {
          staticAccountKeys: [
            { toBase58: () => BUYER_ADDR },
            { toBase58: () => SELLER_ADDR },
            { toBase58: () => PROGRAM_ID },
            { toBase58: () => FEE_VAULT_ADDR },
          ],
          compiledInstructions: [
            { programIdIndex: 2 },
          ],
        },
      },
    };
    mockState.getStatusesThrows = false;
  });

  it("programId + feeVault あり、Program 呼び出し確認 → { valid:true }", async () => {
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
      programId: PROGRAM_ID,
    });
    expect(result.valid).toBeTruthy();
  });

  it("programId 指定で tx に Program 呼び出しが含まれない → { valid:false }", async () => {
    mockState.tx = {
      ...(mockState.tx as Record<string, unknown>),
      transaction: {
        message: {
          staticAccountKeys: [
            { toBase58: () => BUYER_ADDR },
            { toBase58: () => SELLER_ADDR },
            { toBase58: () => PROGRAM_ID },
            { toBase58: () => FEE_VAULT_ADDR },
          ],
          compiledInstructions: [],
        },
      },
    };
    const result = await verifySolanaPurchaseTransaction({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      feeVaultAddress: FEE_VAULT_ADDR,
      programId: PROGRAM_ID,
    });
    expect(result.valid).toBeFalsy();
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — エラーハンドリング
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — エラーハンドリング", () => {
  it("getSignatureStatuses が throw → { valid:false }", async () => {
    mockState.status = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockState.tx = buildDefaultTx();
    mockState.getStatusesThrows = true;
    try {
      const result = await verifySolanaPurchaseTransaction({
        txHash: VALID_TX_HASH,
        token: "SOL" as const,
        expectedRecipient: SELLER_ADDR,
        expectedAmount: 0.1,
      });
      expect(result.valid).toBeFalsy();
    } finally {
      mockState.getStatusesThrows = false;
    }
  });
});
