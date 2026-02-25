import * as assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "mocha";
import { PublicKey } from "@solana/web3.js";

const BUYER_ADDR = "BuyerAddr11111111111111111111111111111111111";
const SELLER_ADDR = "SellerAddr1111111111111111111111111111111111";
const VALID_TX_HASH = "A".repeat(87);
const FEE_VAULT_ADDR = "FeeVaultAddr11111111111111111111111111111111";

// Mutable state shared across tests — each test group resets via beforeEach
let mockStatus: {
  err: unknown;
  confirmationStatus: string;
  slot: number;
  confirmations: number;
} | null = {
  err: null,
  confirmationStatus: "finalized",
  slot: 100,
  confirmations: 10,
};

let mockTx: unknown = null;

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
// Module cache injection
// -----------------------------------------------------------------------
before(() => {
  // connection モック
  const connectionPath = require.resolve("@/lib/solana/connection");
  require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: {
      getConnection: () => ({
        getSignatureStatuses: async (_hashes: string[]) => ({
          value: [mockStatus],
        }),
        getTransaction: async (_hash: string, _opts: unknown) => mockTx,
      }),
    },
    parent: null,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;

  // payment モック
  const paymentPath = require.resolve("@/lib/solana/payment");
  require.cache[paymentPath] = {
    id: paymentPath,
    filename: paymentPath,
    loaded: true,
    exports: {
      getUsdcMint: () =>
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    },
    parent: null,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;

  // verify-transaction をキャッシュから削除して再ロード（モック後に読み込む）
  try {
    delete require.cache[require.resolve("@/lib/solana/verify-transaction")];
  } catch {
    // ignore
  }
});

after(() => {
  try {
    delete require.cache[require.resolve("@/lib/solana/connection")];
  } catch {
    // ignore
  }
  try {
    delete require.cache[require.resolve("@/lib/solana/payment")];
  } catch {
    // ignore
  }
  try {
    delete require.cache[require.resolve("@/lib/solana/verify-transaction")];
  } catch {
    // ignore
  }
});

// -----------------------------------------------------------------------
// isValidSolanaTxHash()
// -----------------------------------------------------------------------
describe("isValidSolanaTxHash()", () => {
  function getIsValid() {
    return (
      require("@/lib/solana/verify-transaction") as {
        isValidSolanaTxHash: (s: string) => boolean;
      }
    ).isValidSolanaTxHash;
  }

  it('87文字 base58 → true ("A".repeat(87))', () => {
    assert.ok(getIsValid()("A".repeat(87)));
  });

  it('88文字 base58 → true ("A".repeat(88))', () => {
    assert.ok(getIsValid()("A".repeat(88)));
  });

  it("86文字 → false", () => {
    assert.ok(!getIsValid()("A".repeat(86)));
  });

  it("base58禁止文字 '0' を含む → false", () => {
    // 87文字だが先頭を '0' にする
    const s = "0" + "A".repeat(86);
    assert.ok(!getIsValid()(s));
  });

  it("base58禁止文字 'O' を含む → false", () => {
    const s = "O" + "A".repeat(86);
    assert.ok(!getIsValid()(s));
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — 早期バリデーション
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — 早期バリデーション", () => {
  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

  it("無効 txHash 形式（86文字） → { valid:false, error: 'Invalid Solana transaction hash format' }", async () => {
    const result = await getVerify()({
      txHash: "A".repeat(86),
      token: "SOL",
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1,
    });
    assert.ok(!result.valid);
    assert.equal(result.error, "Invalid Solana transaction hash format");
  });

  it("expectedAmount = 0 → { valid:false }", async () => {
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL",
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0,
    });
    assert.ok(!result.valid);
  });

  it("token = 'ETH' (unsupported) → { valid:false }", async () => {
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "ETH",
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1,
    });
    assert.ok(!result.valid);
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — オンチェーン状態チェック
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — オンチェーン状態チェック", () => {
  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

  const defaultInput = {
    txHash: VALID_TX_HASH,
    token: "SOL" as const,
    expectedRecipient: SELLER_ADDR,
    expectedAmount: 0.1,
  };

  beforeEach(() => {
    mockStatus = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockTx = buildDefaultTx();
  });

  it("getSignatureStatuses が { value: [null] } を返す → { valid:false }", async () => {
    mockStatus = null;
    const result = await getVerify()(defaultInput);
    assert.ok(!result.valid);
  });

  it("status.err != null → { valid:false }", async () => {
    mockStatus = {
      err: new Error("on-chain error"),
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    const result = await getVerify()(defaultInput);
    assert.ok(!result.valid);
  });

  it("confirmationStatus = 'processed' → { valid:false }", async () => {
    mockStatus = {
      err: null,
      confirmationStatus: "processed",
      slot: 100,
      confirmations: 10,
    };
    const result = await getVerify()(defaultInput);
    assert.ok(!result.valid);
  });

  it("getTransaction が null を返す → { valid:false }", async () => {
    mockTx = null;
    const result = await getVerify()(defaultInput);
    assert.ok(!result.valid);
  });

  it("blockTime が現在から 86401 秒以上前 (24h超) → { valid:false }", async () => {
    mockTx = {
      ...(buildDefaultTx()),
      blockTime: Math.floor(Date.now() / 1000) - 86401,
    };
    const result = await getVerify()(defaultInput);
    assert.ok(!result.valid);
  });

  it("blockTime が未来 (61秒以上先) → { valid:false }", async () => {
    mockTx = {
      ...(buildDefaultTx()),
      blockTime: Math.floor(Date.now() / 1000) + 120,
    };
    const result = await getVerify()(defaultInput);
    assert.ok(!result.valid);
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — 送信者チェック
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — 送信者チェック", () => {
  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

  beforeEach(() => {
    mockStatus = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockTx = buildDefaultTx();
  });

  it("accountKeys[0] !== expectedSender → { valid:false }", async () => {
    // BUYER_ADDR がデフォルト送信者だが、別アドレスを指定する
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.1,
      expectedSender: "OtherAddr1111111111111111111111111111111111",
    });
    assert.ok(!result.valid);
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — SOL 転送検証
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — SOL 転送検証", () => {
  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

  beforeEach(() => {
    mockStatus = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockTx = buildDefaultTx();
  });

  it("正常 SOL 転送 → { valid:true }", async () => {
    // デフォルト: sender 2_000_000_000 → 1_900_000_000 (decrease 100_000_000)
    //            seller 0 → 100_000_000 (receive 100_000_000)
    // expectedAmount = 0.1 SOL = 100_000_000 lamports
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.1,
    });
    assert.ok(result.valid, result.error);
  });

  it("recipient が accountKeys に存在しない → { valid:false }", async () => {
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: "DifferentAddr111111111111111111111111111111",
      expectedAmount: 0.1,
    });
    assert.ok(!result.valid);
  });

  it("recipient 残高差分不足 → { valid:false }", async () => {
    // seller receives only 50_000_000 (0.05 SOL) but expectedAmount = 0.1 SOL
    mockTx = {
      ...(buildDefaultTx()),
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0, 0],
        postBalances: [1_950_000_000, 50_000_000, 0],
        preTokenBalances: [],
        postTokenBalances: [],
      },
    };
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.1,
    });
    assert.ok(!result.valid);
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — SOL split 検証 (feeVaultあり)
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — SOL split 検証 (feeVaultあり)", () => {
  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

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
    mockStatus = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    mockTx = buildSplitTx();
  });

  it("seller 95% + fee 5% 正常 → { valid:true }", async () => {
    // 1 SOL = 1_000_000_000 lamports
    // seller gets 950_000_000 (95%), feeVault gets 50_000_000 (5%)
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    assert.ok(result.valid, result.error);
  });

  it("seller 受取 < 95% (seller postBalance = 900_000_000) → { valid:false }", async () => {
    mockTx = {
      ...buildSplitTx(),
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0, 0, 0],
        postBalances: [1_000_000_000, 900_000_000, 0, 50_000_000],
        preTokenBalances: [],
        postTokenBalances: [],
      },
    };
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    assert.ok(!result.valid);
  });

  it("ダスト金額 (expectedAmount = 0.000000001 SOL → minSellerLamports = 0 になる) → { valid:false }", async () => {
    // 0.000000001 SOL = 1 lamport
    // 95% of 1 = 0 (BigInt truncation) → split検証が無意味なため拒否
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.000000001,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    assert.ok(!result.valid);
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — USDC 転送検証
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — USDC 転送検証", () => {
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

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
    mockStatus = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
  });

  it("正常 USDC 転送 (recipient +1 USDC) → { valid:true }", async () => {
    // 1 USDC = 1_000_000 base units (6 decimals)
    mockTx = buildUsdcTx("1000000", "1000000");
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
    });
    assert.ok(result.valid, result.error);
  });

  it("USDC 受取金額不足 (recipient +0.5 USDC, expected 1 USDC) → { valid:false }", async () => {
    mockTx = buildUsdcTx("500000", "500000");
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
    });
    assert.ok(!result.valid);
  });

  it("recipient の USDC トークンアカウントが存在しない → { valid:false }", async () => {
    mockTx = {
      blockTime: Math.floor(Date.now() / 1000) - 60,
      meta: {
        err: null,
        preBalances: [2_000_000_000, 0],
        postBalances: [1_995_000_000, 0],
        preTokenBalances: [],
        postTokenBalances: [],  // recipient がいない
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
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
    });
    assert.ok(!result.valid);
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — USDC split 検証 (feeVaultあり)
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — USDC split 検証 (feeVaultあり)", () => {
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

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
    mockStatus = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
  });

  it("USDC split: seller 95% + feeVault 5% 正常 → { valid:true }", async () => {
    // 1 USDC = 1_000_000 base units
    // seller gets 950_000 (95%), feeVault gets 50_000 (5%)
    mockTx = buildUsdcSplitTx("950000", "50000", "1000000");
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    assert.ok(result.valid, result.error);
  });

  it("USDC split: seller 受取 < 95% → { valid:false }", async () => {
    // seller gets only 800_000 (80%), not enough
    mockTx = buildUsdcSplitTx("800000", "50000", "1000000");
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    assert.ok(!result.valid);
  });

  it("USDC split: feeVault 受取 < 5% → { valid:false }", async () => {
    // seller gets 950_000 (95%), feeVault gets only 10_000 (1%), not enough
    mockTx = buildUsdcSplitTx("950000", "10000", "1000000");
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    assert.ok(!result.valid);
  });

  it("USDC split: sender 送付額不足（偽装送金）→ { valid:false }", async () => {
    // sender の preBalance は 1_000_000 だが post は 800_000 しか減っていない
    // → 第三者送金による偽装を検出
    mockTx = {
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
            // 送信後残高: 500_000 → sender は 500_000 しか減っていない (expected: 1_000_000)
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
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    assert.ok(!result.valid);
  });

  it("USDC split: ダスト金額 (minSellerAtomic = 0) → { valid:false }", async () => {
    // 0.000001 USDC = 1 base unit
    // 95% of 1 = 0 (BigInt truncation) → split検証不可なため拒否
    mockTx = buildUsdcSplitTx("0", "0", "1");
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "USDC" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 0.000001,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
    });
    assert.ok(!result.valid);
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — programId 分岐検証
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — programId 分岐検証", () => {
  const PROGRAM_ID = "Prog1111111111111111111111111111111111111111";

  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

  beforeEach(() => {
    mockStatus = {
      err: null,
      confirmationStatus: "finalized",
      slot: 100,
      confirmations: 10,
    };
    // programId が含まれる tx: accountKeys[2] = PROGRAM_ID
    mockTx = {
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
            { toBase58: () => PROGRAM_ID },    // index 2
            { toBase58: () => FEE_VAULT_ADDR },
          ],
          compiledInstructions: [
            { programIdIndex: 2 }, // PROGRAM_ID が呼ばれた
          ],
        },
      },
    };
  });

  it("programId + feeVault あり、Program 呼び出し確認 → { valid:true }", async () => {
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      expectedSender: BUYER_ADDR,
      feeVaultAddress: FEE_VAULT_ADDR,
      programId: PROGRAM_ID,
    });
    assert.ok(result.valid, result.error);
  });

  it("programId 指定で tx に Program 呼び出しが含まれない → { valid:false }", async () => {
    // compiledInstructions が空 = Program 未呼び出し
    mockTx = {
      ...(mockTx as Record<string, unknown>),
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
    const result = await getVerify()({
      txHash: VALID_TX_HASH,
      token: "SOL" as const,
      expectedRecipient: SELLER_ADDR,
      expectedAmount: 1.0,
      feeVaultAddress: FEE_VAULT_ADDR,
      programId: PROGRAM_ID,
    });
    assert.ok(!result.valid);
  });
});

// -----------------------------------------------------------------------
// verifySolanaPurchaseTransaction() — エラーハンドリング
// -----------------------------------------------------------------------
describe("verifySolanaPurchaseTransaction() — エラーハンドリング", () => {
  function getVerify() {
    return (
      require("@/lib/solana/verify-transaction") as {
        verifySolanaPurchaseTransaction: (
          input: unknown
        ) => Promise<{ valid: boolean; error?: string }>;
      }
    ).verifySolanaPurchaseTransaction;
  }

  it("getSignatureStatuses が throw → { valid:false }", async () => {
    // connectionPath を上書きして throw するモックに差し替える
    const connectionPath = require.resolve("@/lib/solana/connection");
    const originalModule = require.cache[connectionPath];

    require.cache[connectionPath] = {
      id: connectionPath,
      filename: connectionPath,
      loaded: true,
      exports: {
        getConnection: () => ({
          getSignatureStatuses: async (_hashes: string[]) => {
            throw new Error("RPC network error");
          },
          getTransaction: async (_hash: string, _opts: unknown) => null,
        }),
      },
      parent: null,
      children: [],
      paths: [],
    } as unknown as NodeJS.Module;

    // verify-transaction キャッシュをクリアして再ロード
    try {
      delete require.cache[require.resolve("@/lib/solana/verify-transaction")];
    } catch {
      // ignore
    }

    try {
      const result = await getVerify()({
        txHash: VALID_TX_HASH,
        token: "SOL" as const,
        expectedRecipient: SELLER_ADDR,
        expectedAmount: 0.1,
      });
      assert.ok(!result.valid);
    } finally {
      // 元のモックに戻す
      if (originalModule) {
        require.cache[connectionPath] = originalModule;
      }
      try {
        delete require.cache[require.resolve("@/lib/solana/verify-transaction")];
      } catch {
        // ignore
      }
    }
  });
});
