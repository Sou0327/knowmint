/**
 * GET /api/v1/knowledge/[id]/content — x402 ゲート統合テスト
 *
 * 11シナリオで content route の全分岐をカバーする。
 * モジュール注入は setupContentMocks() で行い、実サーバー不要で CI 実行可能。
 */
import * as assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "mocha";
import {
  setupContentMocks,
  teardownContentMocks,
  setContentTableQueues,
  mockVerifyTx,
  mockSolana,
  mockAuth,
} from "./helpers/supabase-mock";

type GetHandler = (
  req: Request,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

type RouteModule = { GET: GetHandler };

let GET: GetHandler;

const ITEM_ID = "test-item-id";
const BASE_URL = `http://localhost/api/v1/knowledge/${ITEM_ID}/content`;

/** 87文字の base58 文字列 — isValidSolanaTxHash をパスする形式 */
const VALID_TX_HASH = "A".repeat(87);

const SELLER_WALLET = "SellerWalletAddr111111111111111111111111111";
const BUYER_WALLET = "BuyerWalletAddr1111111111111111111111111111";

const publishedItem = {
  seller_id: "seller-user-id",
  price_sol: 0.1,
  price_usdc: null as null,
  status: "published",
  listing_type: "offer",
};

const draftItem = {
  ...publishedItem,
  status: "draft",
};

const mockContent = {
  full_content: "Secret knowledge content",
  file_url: null as null,
};

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request(BASE_URL, {
    method: "GET",
    headers: {
      Authorization: "Bearer km_testkey",
      ...headers,
    },
  });
}

function makeContext(
  id = ITEM_ID
): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** X-PAYMENT ヘッダー用 base64 ペイロードを生成する */
function buildXPayment(txHash: string): string {
  return Buffer.from(
    JSON.stringify({
      scheme: "exact",
      network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      payload: { txHash, asset: "native" },
    })
  ).toString("base64");
}

// ── セットアップ / ティアダウン ───────────────────────────────────────────

before(() => {
  setupContentMocks();
  GET = (
    require("@/app/api/v1/knowledge/[id]/content/route") as RouteModule
  ).GET;
});

after(() => {
  teardownContentMocks();
});

beforeEach(() => {
  setContentTableQueues({});
  mockVerifyTx.result = { valid: true };
  mockSolana.isValidHash = true;
  mockAuth.user = {
    userId: "test-user-id",
    keyId: "test-key-id",
    permissions: ["read"],
  };
});

// ── no X-PAYMENT ヘッダー ────────────────────────────────────────────────

describe("GET /content — no X-PAYMENT ヘッダー", () => {
  it("1. item.status = 'draft' → 404", async () => {
    setContentTableQueues({
      knowledge_items: [{ data: draftItem }],
    });
    const res = await GET(makeRequest(), makeContext());
    assert.equal(res.status, 404);
  });

  it("2. published, 非購入者・非seller → 402 + x402Version:1 + accepts ≥ 1件", async () => {
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
      transactions: [
        {
          data: null, // 確認済み購入なし
          // classic 購入判定フィルタが正しくかかっていることを検証
          expectedCalls: [
            { method: "eq", args: ["buyer_id", "test-user-id"] },
            { method: "eq", args: ["knowledge_item_id", ITEM_ID] },
            { method: "eq", args: ["status", "confirmed"] },
          ],
        },
      ],
      profiles: [{ data: { wallet_address: SELLER_WALLET } }],
    });
    const res = await GET(makeRequest(), makeContext());
    assert.equal(res.status, 402);
    const body = (await res.json()) as {
      x402Version: number;
      accepts: unknown[];
    };
    assert.equal(body.x402Version, 1);
    assert.ok(Array.isArray(body.accepts));
    assert.ok(body.accepts.length >= 1, "accepts should have at least 1 entry");
  });

  it("3. published, seller 本人 → 200 + content", async () => {
    mockAuth.user = {
      userId: "seller-user-id",
      keyId: "test-key-id",
      permissions: ["read"],
    };
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
      knowledge_item_contents: [{ data: mockContent }],
    });
    const res = await GET(makeRequest(), makeContext());
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: { full_content: string };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.full_content, mockContent.full_content);
  });

  it("4. published, confirmed purchase あり → 200 + content", async () => {
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
      transactions: [
        {
          data: { id: "existing-tx-id" },
          // classic 購入判定で buyer_id / knowledge_item_id / status フィルタが確実にかかることを検証
          expectedCalls: [
            { method: "eq", args: ["buyer_id", "test-user-id"] },
            { method: "eq", args: ["knowledge_item_id", ITEM_ID] },
            { method: "eq", args: ["status", "confirmed"] },
          ],
        },
      ],
      knowledge_item_contents: [{ data: mockContent }],
    });
    const res = await GET(makeRequest(), makeContext());
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: { full_content: string };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.full_content, mockContent.full_content);
  });
});

// ── X-PAYMENT ヘッダーあり (x402 flow) ───────────────────────────────────

describe("GET /content — X-PAYMENT ヘッダーあり (x402 flow)", () => {
  it("5. base64 decode できない不正ヘッダー → 402 + error フィールドあり", async () => {
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
    });
    // base64 デコード後に JSON.parse が失敗する値を使用
    const res = await GET(
      makeRequest({ "X-PAYMENT": "invalid-base64!!" }),
      makeContext()
    );
    assert.equal(res.status, 402);
    const body = (await res.json()) as { error?: string };
    assert.ok(body.error, "error field should be present");
  });

  it("6. 不正 tx hash 形式 (mockSolana.isValidHash=false) → 402 + error フィールドあり", async () => {
    mockSolana.isValidHash = false;
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
    });
    const res = await GET(
      makeRequest({ "X-PAYMENT": buildXPayment("short-hash") }),
      makeContext()
    );
    assert.equal(res.status, 402);
    const body = (await res.json()) as { error?: string };
    assert.ok(body.error, "error field should be present");
  });

  it("7. buyer wallet 未設定 (buyerResult.data = null) → 400", async () => {
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
      transactions: [{ data: null }],
      profiles: [
        { data: { wallet_address: SELLER_WALLET } }, // seller
        { data: null },                               // buyer (wallet 未設定)
      ],
    });
    const res = await GET(
      makeRequest({ "X-PAYMENT": buildXPayment(VALID_TX_HASH) }),
      makeContext()
    );
    assert.equal(res.status, 400);
  });

  it("8. verifySolanaPurchaseTransaction → valid:false → 402 + error:Payment verification failed", async () => {
    mockVerifyTx.result = { valid: false, error: "mock verification error" };
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
      transactions: [{ data: null }],
      profiles: [
        { data: { wallet_address: SELLER_WALLET } },
        { data: { wallet_address: BUYER_WALLET } },
      ],
    });
    const res = await GET(
      makeRequest({ "X-PAYMENT": buildXPayment(VALID_TX_HASH) }),
      makeContext()
    );
    assert.equal(res.status, 402);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "Payment verification failed");
  });

  it("9. 有効支払い (verify=valid) → 200 + content (transactions.insert が呼ばれる)", async () => {
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
      transactions: [
        {
          data: null, // 既存 tx チェック → なし
          // tx_hash フィルタが実際にかかっていることを検証（認可クリティカル）
          expectedCalls: [{ method: "eq", args: ["tx_hash", VALID_TX_HASH] }],
        },
        { data: null, error: null }, // insert → 成功
      ],
      profiles: [
        { data: { wallet_address: SELLER_WALLET } },
        { data: { wallet_address: BUYER_WALLET } },
      ],
      knowledge_item_contents: [{ data: mockContent }],
    });
    const res = await GET(
      makeRequest({ "X-PAYMENT": buildXPayment(VALID_TX_HASH) }),
      makeContext()
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: { full_content: string };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.full_content, mockContent.full_content);
  });

  it("10. 同一 tx_hash・同一 buyer・同一 item → confirmed → 200 (idempotent)", async () => {
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
      transactions: [
        {
          data: {
            id: "existing-tx-id",
            buyer_id: "test-user-id",
            knowledge_item_id: ITEM_ID,
            status: "confirmed",
          },
          // 冪等性チェックも tx_hash でフィルタされることを検証
          expectedCalls: [{ method: "eq", args: ["tx_hash", VALID_TX_HASH] }],
        },
      ],
      knowledge_item_contents: [{ data: mockContent }],
    });
    const res = await GET(
      makeRequest({ "X-PAYMENT": buildXPayment(VALID_TX_HASH) }),
      makeContext()
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: { full_content: string };
    };
    assert.equal(body.success, true);
  });

  it("11. 同一 tx_hash だが buyer/item 不一致 → 409 conflict", async () => {
    setContentTableQueues({
      knowledge_items: [{ data: publishedItem }],
      transactions: [
        {
          data: {
            id: "existing-tx-id",
            buyer_id: "other-user-id", // 別ユーザーの tx
            knowledge_item_id: ITEM_ID,
            status: "confirmed",
          },
          // conflict 検出にも tx_hash フィルタが必須（セキュリティ上の核心）
          expectedCalls: [{ method: "eq", args: ["tx_hash", VALID_TX_HASH] }],
        },
      ],
    });
    const res = await GET(
      makeRequest({ "X-PAYMENT": buildXPayment(VALID_TX_HASH) }),
      makeContext()
    );
    assert.equal(res.status, 409);
  });
});
