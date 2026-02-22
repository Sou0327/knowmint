/**
 * POST /api/v1/knowledge/[id]/purchase — 統合テスト
 *
 * purchase ルートの全分岐をモックベースでカバーする。
 * 外部依存（Solana RPC・Supabase）はすべてモック化済みのため CI で実行可能。
 *
 * 注意: before/after/beforeEach はすべて describe ブロック内に配置する。
 * root-level フックは他テストファイルのフックと順序が競合するため使用しない。
 */
import * as assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "mocha";
import {
  setupPurchaseMocks,
  teardownPurchaseMocks,
  setPurchaseTableQueues,
  mockVerifyTx,
  mockSolana,
  mockAuth,
  mockPurchaseRpc,
} from "./helpers/supabase-mock";

type PostHandler = (
  req: Request,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

type RouteModule = { POST: PostHandler };

const ITEM_ID = "test-knowledge-item-id";
const SELLER_ID = "seller-user-id";
const BUYER_ID = "buyer-user-id";
const BASE_URL = `http://localhost/api/v1/knowledge/${ITEM_ID}/purchase`;

/** 87文字の base58 文字列 — isValidSolanaTxHash をパスする形式 */
const VALID_TX_HASH = "A".repeat(87);

const SELLER_WALLET = "SellerWallet111111111111111111111111111111111";
const BUYER_WALLET = "BuyerWallet1111111111111111111111111111111111";

// ── フィクスチャ ──────────────────────────────────────────────────────────

const publishedItem = {
  id: ITEM_ID,
  seller_id: SELLER_ID,
  listing_type: "offer",
  status: "published",
  price_sol: 0.1,
  price_usdc: null as null,
};

const sellerProfile = { id: SELLER_ID, wallet_address: SELLER_WALLET };
const buyerProfile = { id: BUYER_ID, wallet_address: BUYER_WALLET };

const insertedTx = {
  id: "new-tx-id",
  buyer_id: BUYER_ID,
  seller_id: SELLER_ID,
  knowledge_item_id: ITEM_ID,
  amount: 0.1,
  token: "SOL",
  chain: "solana",
  tx_hash: VALID_TX_HASH,
  status: "pending",
  protocol_fee: 0,
  fee_vault_address: null,
};

const confirmedTx = { ...insertedTx, status: "confirmed" };

// ── ヘルパー ──────────────────────────────────────────────────────────────

function makeRequest(
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): Request {
  return new Request(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer km_testkey",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makeContext(
  id = ITEM_ID
): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ── メインスイート ────────────────────────────────────────────────────────

describe("POST /purchase — 統合テスト", () => {
  let POST: PostHandler;

  before(() => {
    setupPurchaseMocks();
    POST = (
      require("@/app/api/v1/knowledge/[id]/purchase/route") as RouteModule
    ).POST;
  });

  after(() => {
    teardownPurchaseMocks();
  });

  beforeEach(() => {
    setPurchaseTableQueues({});
    mockVerifyTx.result = { valid: true };
    mockSolana.isValidHash = true;
    mockPurchaseRpc.confirmTransaction.error = null;
    mockAuth.user = {
      userId: BUYER_ID,
      keyId: "test-key-id",
      permissions: ["read", "write"],
    };
  });

  /** 成功ケース用の完全キューを設定する */
  function setSuccessQueues(): void {
    setPurchaseTableQueues({
      knowledge_items: [
        { data: publishedItem },                     // step 1: item fetch
        { data: { id: ITEM_ID, title: "Test" } },    // step 8: fire-and-forget notify
      ],
      transactions: [
        { data: null },                              // step 2: confirmed check
        { data: null },                              // step 3: tx_hash idempotency
        { data: insertedTx },                        // step 5: insert.select.single
        { data: confirmedTx },                       // step 9: re-fetch confirmed
      ],
      profiles: [{ data: [sellerProfile, buyerProfile] }], // step 4: wallet fetch
    });
  }

  // ── 入力バリデーション ────────────────────────────────────────────────

  describe("入力バリデーション", () => {
    it("tx_hash 省略 → 400", async () => {
      const res = await POST(makeRequest({}), makeContext());
      assert.equal(res.status, 400);
    });

    it("tx_hash 空文字 → 400", async () => {
      const res = await POST(makeRequest({ tx_hash: "  " }), makeContext());
      assert.equal(res.status, 400);
    });

    it("chain = 'ethereum' → 400", async () => {
      const res = await POST(
        makeRequest({ tx_hash: VALID_TX_HASH, chain: "ethereum" }),
        makeContext()
      );
      assert.equal(res.status, 400);
    });

    it("token = 'ETH' → 400 (Solana chain に ETH は非対応)", async () => {
      const res = await POST(
        makeRequest({ tx_hash: VALID_TX_HASH, token: "ETH" }),
        makeContext()
      );
      assert.equal(res.status, 400);
    });

    it("isValidSolanaTxHash = false → 400", async () => {
      mockSolana.isValidHash = false;
      const res = await POST(
        makeRequest({ tx_hash: "short" }),
        makeContext()
      );
      assert.equal(res.status, 400);
    });
  });

  // ── 認証・権限 ────────────────────────────────────────────────────────

  describe("認証・権限", () => {
    it("未認証 (mockAuth.user = null) → 401", async () => {
      mockAuth.user = null;
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 401);
    });

    it("write 権限なし → 403", async () => {
      mockAuth.user = {
        userId: BUYER_ID,
        keyId: "test-key-id",
        permissions: ["read"],
      };
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 403);
    });
  });

  // ── item チェック ─────────────────────────────────────────────────────

  describe("item チェック", () => {
    it("item 存在しない (PGRST116 エラー) → 404", async () => {
      setPurchaseTableQueues({
        knowledge_items: [
          { data: null, error: { code: "PGRST116", message: "not found" } },
        ],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 404);
    });

    it("item.status = 'draft' → 400 (購入不可)", async () => {
      setPurchaseTableQueues({
        knowledge_items: [
          { data: { ...publishedItem, status: "draft" } },
        ],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 400);
    });

    it("item.listing_type = 'request' → 400 (request 出品は購入不可)", async () => {
      setPurchaseTableQueues({
        knowledge_items: [
          { data: { ...publishedItem, listing_type: "request" } },
        ],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 400);
    });

    it("seller_id === user.userId (自己購入) → 400", async () => {
      mockAuth.user = {
        userId: SELLER_ID,
        keyId: "test-key-id",
        permissions: ["read", "write"],
      };
      setPurchaseTableQueues({
        knowledge_items: [{ data: publishedItem }],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 400);
    });
  });

  // ── 価格チェック ──────────────────────────────────────────────────────

  describe("価格チェック", () => {
    it("price_sol = null, token = 'SOL' → 400", async () => {
      setPurchaseTableQueues({
        knowledge_items: [
          { data: { ...publishedItem, price_sol: null } },
        ],
      });
      const res = await POST(
        makeRequest({ tx_hash: VALID_TX_HASH, token: "SOL" }),
        makeContext()
      );
      assert.equal(res.status, 400);
    });

    it("token = 'USDC', price_usdc = null → 400", async () => {
      setPurchaseTableQueues({
        knowledge_items: [
          { data: { ...publishedItem, price_usdc: null } },
        ],
      });
      const res = await POST(
        makeRequest({ tx_hash: VALID_TX_HASH, token: "USDC" }),
        makeContext()
      );
      assert.equal(res.status, 400);
    });

    it("price_sol = 0 → 400", async () => {
      setPurchaseTableQueues({
        knowledge_items: [
          { data: { ...publishedItem, price_sol: 0 } },
        ],
      });
      const res = await POST(
        makeRequest({ tx_hash: VALID_TX_HASH, token: "SOL" }),
        makeContext()
      );
      assert.equal(res.status, 400);
    });
  });

  // ── 重複・冪等性チェック ──────────────────────────────────────────────

  describe("重複・冪等性チェック", () => {
    it("confirmed TX 存在 (buyer + item が一致) → 409 'already purchased'", async () => {
      setPurchaseTableQueues({
        knowledge_items: [{ data: publishedItem }],
        transactions: [
          {
            data: { id: "existing-confirmed-tx" },
            expectedCalls: [
              { method: "eq", args: ["buyer_id", BUYER_ID] },
              { method: "eq", args: ["knowledge_item_id", ITEM_ID] },
              { method: "eq", args: ["status", "confirmed"] },
            ],
          },
        ],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 409);
      const body = (await res.json()) as { error: { message: string } };
      assert.ok(body.error.message.includes("already purchased"));
    });

    it("同一 tx_hash + 同一 buyer + 同一 item → 200 (冪等)", async () => {
      const existingTx = {
        id: "idempotent-tx-id",
        buyer_id: BUYER_ID,
        knowledge_item_id: ITEM_ID,
        tx_hash: VALID_TX_HASH,
        status: "confirmed",
      };
      setPurchaseTableQueues({
        knowledge_items: [{ data: publishedItem }],
        transactions: [
          { data: null }, // step 2: no confirmed purchase
          {
            data: existingTx, // step 3: idempotency — same tx, same buyer/item
            expectedCalls: [
              { method: "eq", args: ["tx_hash", VALID_TX_HASH] },
            ],
          },
        ],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 200);
      const body = (await res.json()) as { success: boolean };
      assert.equal(body.success, true);
    });

    it("同一 tx_hash + 別 buyer → 409 'Transaction hash is already used'", async () => {
      const otherBuyerTx = {
        id: "other-buyer-tx-id",
        buyer_id: "other-buyer-id",
        knowledge_item_id: ITEM_ID,
        tx_hash: VALID_TX_HASH,
        status: "confirmed",
      };
      setPurchaseTableQueues({
        knowledge_items: [{ data: publishedItem }],
        transactions: [
          { data: null },      // step 2: no confirmed for current buyer
          {
            data: otherBuyerTx, // step 3: same tx_hash but different buyer
            expectedCalls: [
              { method: "eq", args: ["tx_hash", VALID_TX_HASH] },
            ],
          },
        ],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 409);
      const body = (await res.json()) as { error: { message: string } };
      assert.ok(body.error.message.includes("already used"));
    });
  });

  // ── wallet チェック ───────────────────────────────────────────────────

  describe("wallet チェック", () => {
    it("seller wallet_address = null → 400", async () => {
      setPurchaseTableQueues({
        knowledge_items: [{ data: publishedItem }],
        transactions: [
          { data: null }, // step 2
          { data: null }, // step 3
        ],
        profiles: [
          {
            data: [
              { id: SELLER_ID, wallet_address: null },
              { id: BUYER_ID, wallet_address: BUYER_WALLET },
            ],
          },
        ],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 400);
    });

    it("buyer wallet_address = null → 400", async () => {
      setPurchaseTableQueues({
        knowledge_items: [{ data: publishedItem }],
        transactions: [
          { data: null }, // step 2
          { data: null }, // step 3
        ],
        profiles: [
          {
            data: [
              { id: SELLER_ID, wallet_address: SELLER_WALLET },
              { id: BUYER_ID, wallet_address: null },
            ],
          },
        ],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 400);
    });
  });

  // ── TX 検証失敗 ───────────────────────────────────────────────────────

  describe("TX 検証失敗", () => {
    it("verifySolanaPurchaseTransaction → valid:false → 400", async () => {
      mockVerifyTx.result = { valid: false, error: "mock: amount mismatch" };
      setPurchaseTableQueues({
        knowledge_items: [{ data: publishedItem }],
        transactions: [
          { data: null }, // step 2
          { data: null }, // step 3
        ],
        profiles: [{ data: [sellerProfile, buyerProfile] }],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 400);
    });
  });

  // ── DB エラー ─────────────────────────────────────────────────────────

  describe("DB エラー", () => {
    it("transactions insert: code = '23505' → 409", async () => {
      setPurchaseTableQueues({
        knowledge_items: [
          { data: publishedItem },
          { data: { id: ITEM_ID, title: "Test" } }, // step 8 fire-and-forget
        ],
        transactions: [
          { data: null },  // step 2
          { data: null },  // step 3
          { data: null, error: { code: "23505", message: "duplicate key" } }, // step 5
        ],
        profiles: [{ data: [sellerProfile, buyerProfile] }],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 409);
    });

    it("rpc('confirm_transaction') エラー → 400 'Transaction verification failed'", async () => {
      mockPurchaseRpc.confirmTransaction.error = {
        message: "RPC error: something went wrong",
      };
      setPurchaseTableQueues({
        knowledge_items: [
          { data: publishedItem },
          { data: { id: ITEM_ID, title: "Test" } }, // step 8 fire-and-forget
        ],
        transactions: [
          { data: null },       // step 2
          { data: null },       // step 3
          { data: insertedTx }, // step 5: insert succeeds
        ],
        profiles: [{ data: [sellerProfile, buyerProfile] }],
      });
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { message: string } };
      assert.ok(
        body.error.message.includes("Transaction verification failed"),
        `Expected 'Transaction verification failed' but got: ${body.error.message}`
      );
    });
  });

  // ── 成功 ──────────────────────────────────────────────────────────────

  describe("成功", () => {
    it("正常購入 → 200 + confirmedTx データ", async () => {
      setSuccessQueues();
      const res = await POST(makeRequest({ tx_hash: VALID_TX_HASH }), makeContext());
      assert.equal(res.status, 200);

      const body = (await res.json()) as {
        success: boolean;
        data: { id: string; status: string; tx_hash: string };
      };
      assert.equal(body.success, true);
      assert.equal(body.data.id, confirmedTx.id);
      assert.equal(body.data.status, "confirmed");
      assert.equal(body.data.tx_hash, VALID_TX_HASH);
    });

    it("token = 'USDC' で purchase → 200", async () => {
      const usdcItem = { ...publishedItem, price_usdc: 1.0, price_sol: null };
      const usdcInsertedTx = { ...insertedTx, token: "USDC", amount: 1.0 };
      const usdcConfirmedTx = { ...usdcInsertedTx, status: "confirmed" };

      setPurchaseTableQueues({
        knowledge_items: [
          { data: usdcItem },
          { data: { id: ITEM_ID, title: "Test" } }, // fire-and-forget
        ],
        transactions: [
          { data: null },             // step 2
          { data: null },             // step 3
          { data: usdcInsertedTx },   // step 5
          { data: usdcConfirmedTx },  // step 9
        ],
        profiles: [{ data: [sellerProfile, buyerProfile] }],
      });

      const res = await POST(
        makeRequest({ tx_hash: VALID_TX_HASH, token: "USDC" }),
        makeContext()
      );
      assert.equal(res.status, 200);
      const body = (await res.json()) as { success: boolean };
      assert.equal(body.success, true);
    });
  });
});
