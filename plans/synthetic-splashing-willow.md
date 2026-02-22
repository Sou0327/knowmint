# Phase 15: テスト環境整備 — 実装計画

## Context

Phase 1-14・20・21が完了し、コアロジックはすべて実装済みだが、
テストがすべてモックベースのため RLS・DB トリガー・Solana devnet の
実動作が未検証。Phase 12 (mainnet) への前提条件として Phase 15 を先行させる。

**実施スコープ（今回）**:
- 15.5: モックベーステスト追加 — 外部依存なし、即実装可能
- 15.3 前準備: devnet キーペア生成スクリプト / env テンプレート
- 15.1 準備: Supabase staging シードスクリプト + `.env.test.example`

**外部操作が必要で別途対応**:
- 15.1: Supabase staging プロジェクト作成（ダッシュボード操作）
- 15.2: 実 DB 統合テスト（15.1 完了後）
- 15.3: devnet 実送金 E2E（15.1 完了後）
- 15.4: Webhook 疎通確認（webhook.site 等、手動）

---

## 実装ファイル一覧

| ファイル | 種別 | 概要 |
|--------|------|------|
| `tests/integration/helpers/supabase-mock.ts` | 既存・追記 | purchase 用 mock 追加 |
| `tests/integration/purchase.integration.test.ts` | 新規 | 購入 API 統合テスト |
| `tests/unit/solana/verify-transaction.test.ts` | 新規 | Solana 検証ユニットテスト |
| `tests/unit/webhooks/retry.test.ts` | 新規 | Webhook retry ユニットテスト |
| `scripts/e2e/devnet-setup.mjs` | 新規 | devnet キーペア生成スクリプト |
| `.env.test.example` | 新規 | テスト環境設定テンプレート |
| `scripts/seed/staging-seed.ts` | 新規 | Supabase staging シードデータ |

---

## Step 1: `supabase-mock.ts` への追加

**ファイル**: `tests/integration/helpers/supabase-mock.ts`

`purchase/route.ts` 向けに以下を追加（既存パターンを踏襲）:

```typescript
// ── purchase ルート用モック状態 ────────────────────────────────────────────

export const mockPurchaseRpc = {
  confirmTransaction: { error: null as null | { code?: string; message?: string } },
};

let _purchaseTableQueues: Record<string, QueueEntry[]> = {};

export function setPurchaseTableQueues(queues: Record<string, QueueEntry[]>): void {
  _purchaseTableQueues = queues;
}

/** rpc() 対応の拡張クライアント */
function createPurchaseMockAdminClient() {
  const base = createTableQueuedMockAdminClient(_purchaseTableQueues);
  return {
    from: base.from,
    rpc: (name: string, _args?: unknown) => {
      if (name === "confirm_transaction") {
        return Promise.resolve({ error: mockPurchaseRpc.confirmTransaction.error });
      }
      // increment_purchase_count は fire-and-forget なので常に成功
      return Promise.resolve({ error: null });
    },
  };
}

export function setupPurchaseMocks(): void {
  resetMockAuth();
  mockAuth.user = {
    userId: "buyer-user-id",
    keyId: "test-key-id",
    permissions: ["read", "write"],
  };

  injectModule(resolveAlias("@/lib/api/response"), responseMockExports);
  injectModule(resolveAlias("@/lib/api/middleware"), buildWithApiAuthMock());
  injectModule(resolveAlias("@/lib/supabase/admin"), {
    getAdminClient: () => createPurchaseMockAdminClient(),
  });
  injectModule(resolveAlias("@/lib/audit/log"), { logAuditEvent: () => {} });
  injectModule(resolveAlias("@/lib/solana/verify-transaction"), {
    verifySolanaPurchaseTransaction: async () => mockVerifyTx.result,
    isValidSolanaTxHash: () => mockSolana.isValidHash,
  });
  injectModule(resolveAlias("@/lib/notifications/create"), {
    notifyPurchase: async () => {},
  });
  injectModule(resolveAlias("@/lib/webhooks/events"), {
    fireWebhookEvent: async () => {},
  });
}

export function teardownPurchaseMocks(): void {
  const paths = [
    "@/lib/api/response",
    "@/lib/api/middleware",
    "@/lib/supabase/admin",
    "@/lib/audit/log",
    "@/lib/solana/verify-transaction",
    "@/lib/notifications/create",
    "@/lib/webhooks/events",
    "@/app/api/v1/knowledge/[id]/purchase/route",
  ];
  for (const p of paths) clearModule(p);
}
```

---

## Step 2: `purchase.integration.test.ts`

**ファイル**: `tests/integration/purchase.integration.test.ts`

### purchase/route.ts の正確な DB クエリ順序

```
1. knowledge_items.select().eq("id",id).single()
2. transactions.select("id").eq(buyer_id).eq(knowledge_item_id).eq(status,"confirmed").limit(1).maybeSingle()
3. transactions.select().eq("tx_hash",...).maybeSingle()
4. profiles.select("id,wallet_address").in("id",[seller_id,buyer_id])  ← .then() で直接 await
5. transactions.insert({...}).select().single()
6. rpc("confirm_transaction", {tx_id})                                  ← await
7. rpc("increment_purchase_count", {item_id})                           ← fire-and-forget
8. knowledge_items.select("id,title").eq("id",id).single().then(...)   ← fire-and-forget（notifyPurchase用）
9. transactions.select().eq("id", transaction.id).single()
```

### 成功ケースのキュー設計

```typescript
setPurchaseTableQueues({
  knowledge_items: [
    { data: publishedItem },                            // step 1
    { data: { id: ITEM_ID, title: "Test" } },           // step 8 (fire-and-forget)
  ],
  transactions: [
    { data: null },                                     // step 2 (confirmed check)
    { data: null },                                     // step 3 (tx_hash idempotency)
    { data: insertedTx },                               // step 5 (insert.select.single)
    { data: confirmedTx },                              // step 9 (re-fetch)
  ],
  profiles: [{ data: [sellerProfile, buyerProfile] }],  // step 4 (.then)
});
```

### テストケース一覧

```
describe("POST /purchase — 入力バリデーション")
  ✓ tx_hash 省略 → 400
  ✓ tx_hash 空文字 → 400
  ✓ chain = "ethereum" → 400
  ✓ token = "ETH" → 400
  ✓ isValidSolanaTxHash = false → 400

describe("POST /purchase — 認証・権限")
  ✓ 未認証 (mockAuth.user = null) → 401
  ✓ write 権限なし → 403

describe("POST /purchase — item チェック")
  ✓ item 存在しない (PGRST116 エラー) → 404
  ✓ item.status = "draft" → 400
  ✓ item.listing_type = "request" → 400
  ✓ seller_id === user.userId (自己購入) → 400

describe("POST /purchase — 価格チェック")
  ✓ price_sol = null, token = "SOL" → 400
  ✓ price_sol = 0 → 400

describe("POST /purchase — 重複・冪等性チェック")
  ✓ confirmed TX 存在 → 409 "already purchased"
    (expectedCalls: eq(buyer_id), eq(knowledge_item_id), eq(status,"confirmed"))
  ✓ 同一 tx_hash + 同一 buyer + 同一 item → 200 (冪等)
    (expectedCalls: eq(tx_hash, VALID_TX_HASH))
  ✓ 同一 tx_hash + 別 buyer → 409 "Transaction hash is already used"

describe("POST /purchase — wallet チェック")
  ✓ seller wallet_address = null → 400
  ✓ buyer wallet_address = null → 400

describe("POST /purchase — TX 検証失敗")
  ✓ verifySolanaPurchaseTransaction → valid:false → 400

describe("POST /purchase — DB エラー")
  ✓ transactions insert: code = "23505" → 409
  ✓ rpc("confirm_transaction") → error → 400 "Transaction verification failed"

describe("POST /purchase — 成功")
  ✓ 正常購入 → 200 + confirmedTx データ
```

---

## Step 3: `verify-transaction.test.ts`

**ファイル**: `tests/unit/solana/verify-transaction.test.ts`

### モック戦略

`getConnection()` と `getUsdcMint()` を require.cache 注入でモック化した後に
`verifySolanaPurchaseTransaction` を require する。

```typescript
// before() で注入
require.cache[require.resolve("@/lib/solana/connection")] = {
  exports: { getConnection: () => mockConnectionObj }
};
require.cache[require.resolve("@/lib/solana/payment")] = {
  exports: { getUsdcMint: () => new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") }
};
// その後 require("@/lib/solana/verify-transaction")
```

### テストケース一覧（主要）

```
describe("isValidSolanaTxHash()")
  ✓ 87 文字 base58 → true
  ✓ 88 文字 base58 → true
  ✓ 86 文字 → false
  ✓ 0/O (禁止文字) → false

describe("早期バリデーション")
  ✓ 無効 txHash 形式 → { valid:false, error: "Invalid Solana transaction hash format" }
  ✓ expectedAmount = 0 → { valid:false }
  ✓ token = "ETH" → { valid:false }

describe("オンチェーン状態チェック")
  ✓ getSignatureStatuses[0] = null → { valid:false }
  ✓ status.err != null → { valid:false }
  ✓ confirmationStatus = "processed" → { valid:false }
  ✓ getTransaction → null → { valid:false }
  ✓ blockTime が 3601 秒以上前 → { valid:false }

describe("送信者チェック")
  ✓ accountKeys[0] !== expectedSender → { valid:false }

describe("SOL 転送検証")
  ✓ 正常転送（残高差分 ≥ expected） → { valid:true }
  ✓ recipient 残高差分不足 → { valid:false }
  ✓ recipient が accountKeys に存在しない → { valid:false }

describe("SOL split 検証（feeVaultあり）")
  ✓ seller 95% + fee 5% 正常 → { valid:true }
  ✓ seller 受取 < 95% → { valid:false }
  ✓ ダスト金額（minSellerLamports=0） → { valid:false }

describe("USDC 転送検証")
  ✓ 正常 USDC 転送（tokenBalances 差分） → { valid:true }
  ✓ USDC 金額不足 → { valid:false }

describe("エラーハンドリング")
  ✓ getSignatureStatuses が throw → { valid:false }
```

---

## Step 4: `retry.test.ts`

**ファイル**: `tests/unit/webhooks/retry.test.ts`

### モック戦略

```typescript
// 1. dispatch モジュールを require.cache 注入
require.cache[require.resolve("@/lib/webhooks/dispatch")] = {
  exports: { dispatchWebhook: async () => mockDispatch.results.shift() }
};
// 2. retry モジュールを require
const { dispatchWithRetry } = require("@/lib/webhooks/retry");

// 3. setTimeout をグローバルスタブに差し替え（実時間待機を回避）
let capturedDelays: number[] = [];
globalThis.setTimeout = (fn, ms) => { capturedDelays.push(ms); fn(); return 0; };
```

### テストケース一覧

```
describe("成功ケース")
  ✓ 1 回目成功 → dispatchWebhook が 1 回のみ、delay なし
  ✓ 1 回失敗 → 2 回目成功 → delay 1 件 (900-1100ms)
  ✓ 2 回失敗 → 3 回目成功 → delay 2 件 ([~1000ms, ~2000ms])

describe("永続エラー（リトライなし）")
  ✓ error: "no_signing_secret" → 1 回で終了
  ✓ error: "decrypt_failed" → 1 回で終了
  ✓ error: "ssrf_rejected" → 1 回で終了
  ✓ statusCode: 400 → 1 回で終了
  ✓ statusCode: 403 → 1 回で終了
  ✓ statusCode: 422 → 1 回で終了

describe("リトライ対象")
  ✓ statusCode: 429 → リトライする
  ✓ statusCode: 500 → リトライする
  ✓ statusCode: 503 → リトライする
  ✓ error: "timeout" → リトライする

describe("全試行失敗")
  ✓ maxRetries=3 全失敗 → 3 回呼ばれ、delay 2 件

describe("maxRetries カスタマイズ")
  ✓ maxRetries=1 → 1 回で終了（delay なし）

describe("バックオフ順序")
  ✓ delay[1] > delay[0] (指数バックオフ)
```

---

## Step 5: `scripts/e2e/devnet-setup.mjs`

`scripts/generate-fee-vault.mjs` のパターンを踏襲:

```javascript
#!/usr/bin/env node
// buyer/seller 各 Keypair.generate() → JSON 保存 → chmod 600
// 上書き防止チェック（既存ファイルがあれば exit(1)）
// stdout に pubkey + airdrop コマンド案内を出力
// .env.test の Solana セクションテンプレートを出力
```

出力ファイル: `devnet-buyer-keypair.json`, `devnet-seller-keypair.json`
（.gitignore に追加必須）

---

## Step 6: `.env.test.example`

```bash
# Supabase Staging (Phase 15.1)
NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Solana devnet (Phase 15.3)
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
TEST_BUYER_WALLET=<devnet-setup.mjs の出力>
TEST_SELLER_WALLET=<devnet-setup.mjs の出力>
TEST_BUYER_KEYPAIR_PATH=./devnet-buyer-keypair.json
TEST_SELLER_KEYPAIR_PATH=./devnet-seller-keypair.json

# テスト用 API キー (staging-seed.ts 実行後)
TEST_API_KEY_BUYER=km_...
TEST_API_KEY_SELLER=km_...
```

---

## Step 7: `scripts/seed/staging-seed.ts`

```typescript
#!/usr/bin/env ts-node
// 1. 環境変数チェック (SUPABASE_URL + SERVICE_ROLE_KEY 必須)
// 2. createClient でテストユーザー 2 名作成 (seller + buyer)
// 3. profiles upsert (wallet_address は .env.test の TEST_*_WALLET から)
// 4. knowledge_items upsert (published 3 件 + draft 1 件 + request 1 件)
// 5. knowledge_item_contents upsert (published のみ)
// 6. api_keys insert → rawKey を stdout に出力
// 7. 完了サマリ + .env.test 追記ガイドを表示
```

---

## 検証方法

```bash
# Step 2-3 後 — ユニットテスト全体
npm run test:unit

# Step 2-4 後 — 統合テスト全体
npm run test:integration

# Step 5 後 — devnet キーペア生成
node scripts/e2e/devnet-setup.mjs

# Step 7 後 — staging シード（15.1 完了後）
dotenv -e .env.test -- npx ts-node scripts/seed/staging-seed.ts
```

---

## 実装順序

```
1. supabase-mock.ts 追記           (他 step の前提)
2. purchase.integration.test.ts   (step 1 完了後)
3. verify-transaction.test.ts     (独立)
4. retry.test.ts                  (独立)
5. devnet-setup.mjs               (独立)
6. .env.test.example              (独立)
7. staging-seed.ts                (独立、15.1 完了後に実行)
```
