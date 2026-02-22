# Phase 15: テスト環境整備 — 実装計画

## Context

現状のテストはすべてモックベースで、実 Supabase/devnet に繋ぐテストがなく RLS・DB トリガー・スマートコントラクトの動作が未検証。Phase 12（mainnet 移行）の着手前提条件（P0）として本フェーズを完了する必要がある。

**実施内容**: 以下の 5 サブタスクのうち、コードで実装できるものをすべて実施する。15.1〜15.4 の外部インフラ（Supabase staging 作成、devnet アカウント）は手動ステップとなるが、スクリプト・テストファイルの骨格はすべて用意する。

---

## 修正対象ファイル

### 既存ファイルの修正（3件）

| ファイル | 変更内容 |
|---|---|
| `tests/integration/helpers/supabase-mock.ts` | `in()` / `rpc()` 対応、`mockRpc` 状態、`mockDbSequence`、`setupPurchaseMocks()` / `teardownPurchaseMocks()` 追加 |
| `package.json` | `test:staging` / `test:e2e:devnet` / `test:webhook:connectivity` スクリプト追加 |
| `.gitignore` | `.env.test` / `.keys/` を除外 |

### 新規作成ファイル（10件）

| ファイル | 対応サブタスク | 概要 |
|---|---|---|
| `.env.test.example` | 15.1 | staging 接続情報テンプレート（秘密情報なし） |
| `scripts/staging/seed.mjs` | 15.1 | staging DB シードデータ投入スクリプト |
| `tests/integration/purchase.integration.test.ts` | 15.5 | 購入 API 統合テスト（17 ケース、モックベース） |
| `tests/unit/solana/verify-transaction.test.ts` | 15.5 | Solana 検証ユニットテスト（18 ケース） |
| `tests/unit/webhooks/retry.test.ts` | 15.5 | Webhook リトライユニットテスト（11 ケース） |
| `tests/staging/rls.staging.test.ts` | 15.2 | RLS ポリシー検証（staging 接続、env vars なし時はスキップ） |
| `tests/staging/rpc.staging.test.ts` | 15.2 | confirm_transaction / increment_purchase_count RPC 検証 |
| `scripts/devnet/generate-wallets.mjs` | 15.3 | devnet テストウォレット生成（`.keys/` に保存） |
| `scripts/devnet/faucet.mjs` | 15.3 | devnet SOL airdrop スクリプト |
| `scripts/e2e/devnet-purchase-flow.mjs` | 15.3 | devnet 購入フロー E2E |
| `scripts/e2e/webhook-connectivity.mjs` | 15.4 | webhook.site 等への実配信確認スクリプト |

---

## 実装詳細

### Step 1: supabase-mock.ts の拡張

`tests/integration/helpers/supabase-mock.ts` に以下を追加：

#### 1-A: `noopMethods` に `in` を追加（purchase ルートが `.in("id", [...])` を使用）

```typescript
const noopMethods = [
  "select", "insert", "update", "delete",
  "eq", "neq", "gte", "lte", "in",       // "in" を追加
  "order", "limit", "range", "textSearch", "contains",
];
```

#### 1-B: `mockRpc` 状態と `rpc()` サポート

```typescript
export const mockRpc: Record<string, { data?: unknown; error?: unknown }> = {};

export function resetMockRpc(overrides?: Record<string, unknown>): void {
  Object.keys(mockRpc).forEach(k => delete mockRpc[k]);
  Object.assign(mockRpc, {
    confirm_transaction: { data: null, error: null },
    increment_purchase_count: { data: null, error: null },
    ...overrides,
  });
}

// createMockAdminClient() に rpc() を追加
export function createMockAdminClient() {
  return {
    from: () => createChain(),
    rpc: (name: string) => {
      const result = mockRpc[name] ?? { data: null, error: null };
      const r: Record<string, unknown> = {};
      r["then"] = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(result).then(resolve, reject);
      r["throwOnError"] = () => {
        if (result.error) throw result.error;
        return r;
      };
      return r;
    },
  };
}
```

#### 1-C: `mockDbSequence`（purchase のような多段クエリ対応）

```typescript
export const mockDbSequence: Array<{ data: unknown; error?: unknown }> = [];
let _seqIndex = 0;

export function resetMockDbSequence(seq: Array<{ data: unknown; error?: unknown }>): void {
  mockDbSequence.length = 0;
  mockDbSequence.push(...seq);
  _seqIndex = 0;
}

// createChain() の single() / maybeSingle() を差し替え
// mockDbSequence に要素があれば順番に消費、なければ mockDb.singleData を使用
chain["single"] = () => {
  if (_seqIndex < mockDbSequence.length) {
    const r = mockDbSequence[_seqIndex++];
    return Promise.resolve({ data: r.data, error: r.error ?? null });
  }
  return Promise.resolve({ data: mockDb.singleData, error: mockDb.singleError });
};
chain["maybeSingle"] = () => { /* 同様 */ };
```

**注意**: `_seqIndex` はモジュールレベルのクロージャ変数として管理し、`resetMockDbSequence()` でリセット。

#### 1-D: `mockVerifyResult` と `setupPurchaseMocks()` / `teardownPurchaseMocks()`

```typescript
export let mockVerifyResult: { valid: boolean; error?: string } = { valid: true };

export function setMockVerifyResult(r: typeof mockVerifyResult): void {
  mockVerifyResult = r;
}

export function setupPurchaseMocks(): void {
  resetMockAuth();
  resetMockRpc();
  resetMockDbSequence([]);
  mockVerifyResult = { valid: true };

  // purchase ルートが require する実モジュールから isValidSolanaTxHash を取得
  // (実際のバリデーション関数はそのまま使い、verifySolana だけモック)
  const realVerify = require("@/lib/solana/verify-transaction") as {
    isValidSolanaTxHash: (h: string) => boolean;
  };

  injectModule(resolveAlias("@/lib/api/response"), responseMockExports);
  injectModule(resolveAlias("@/lib/api/middleware"), buildWithApiAuthMock());
  injectModule(resolveAlias("@/lib/supabase/admin"), {
    getAdminClient: () => createMockAdminClient(),
  });
  injectModule(resolveAlias("@/lib/audit/log"), { logAuditEvent: () => {} });
  injectModule(resolveAlias("@/lib/solana/verify-transaction"), {
    isValidSolanaTxHash: realVerify.isValidSolanaTxHash, // 実関数を保持
    verifySolanaPurchaseTransaction: async () => mockVerifyResult,
  });
  injectModule(resolveAlias("@/lib/webhooks/events"), {
    fireWebhookEvent: async () => {},
  });
  injectModule(resolveAlias("@/lib/notifications/create"), {
    notifyPurchase: async () => {},
  });
}

export function teardownPurchaseMocks(): void {
  const paths = [
    "@/lib/api/response", "@/lib/api/middleware",
    "@/lib/supabase/admin", "@/lib/audit/log",
    "@/lib/solana/verify-transaction",
    "@/lib/webhooks/events", "@/lib/notifications/create",
    "@/app/api/v1/knowledge/[id]/purchase/route",
  ];
  for (const p of paths) clearModule(p);
  resetMockDbSequence([]);
}
```

**重要**: `setupPurchaseMocks()` 内で `realVerify` を取得する前に、verify-transaction のキャッシュが残っていると古いモジュールを掴む可能性がある。`teardownPurchaseMocks()` で必ずキャッシュをクリアすること。

---

### Step 2: `purchase.integration.test.ts` — 17 テストケース

```
tests/integration/purchase.integration.test.ts
```

**共通セットアップ**:
```typescript
// 実装時に purchase/route.ts を読んで全DB呼び出し順序を確認すること
const VALID_TX = "5KtPn1LGuxhFiwjxEEGa" + "1".repeat(67); // 88文字の有効 Base58
const BASE_ITEM = {
  id: "item-id", seller_id: "seller-user-id",
  status: "published", listing_type: "offer",
  price_sol: 0.1, price_usdc: null,
  // ...全フィールド
};

function makeRequest(body: object): Request {
  return new Request("http://localhost/api/v1/knowledge/item-id/purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer km_test" },
    body: JSON.stringify(body),
  });
}

function makeContext(id = "item-id") {
  return { params: Promise.resolve({ id }) };
}
```

**テストケース一覧**:

| TC | 概要 | セットアップ | 期待 |
|---|---|---|---|
| 01 | tx_hash 省略 | body なし | 400, bad_request |
| 02 | tx_hash 空文字 | tx_hash: "" | 400 |
| 03 | Base58 形式不正（"fake_tx_hash_should_fail"） | tx_hash: "fake_tx_hash_should_fail" | 400 |
| 04 | chain が "base" | chain: "base" | 400 |
| 05 | token が "ETH" | token: "ETH" | 400 |
| 06 | アイテム不存在 | seq[0]: null | 404 |
| 07 | status が "draft" | seq[0]: {..., status: "draft"} | 400 |
| 08 | listing_type が "request" | seq[0]: {..., listing_type: "request"} | 400 |
| 09 | 自己購入（seller_id === user.userId） | seq[0]: {..., seller_id: "test-user-id"} | 400 |
| 10 | price_sol が null (SOL購入) | seq[0]: {..., price_sol: null} | 400 |
| 11 | 重複購入（confirmed 済み） | seq[0]: valid_item, seq[1]: {id: "existing-tx"} | 409 |
| 12 | tx_hash 重複（他ユーザーで使用済み） | seq[0]: valid_item, seq[1]: null, seq[2]: {buyer_id: "other"} | 409 |
| 13 | tx_hash 冪等性（同ユーザー・同アイテム） | seq[0]: valid_item, seq[1]: null, seq[2]: {buyer_id: "test-user-id", knowledge_item_id: "item-id"} | 200 |
| 14 | 認証なし（401） | mockAuth.user = null | 401 |
| 15 | write 権限なし | mockAuth.user.permissions = ["read"] | 403 |
| 16 | verifySolana が valid:false | mockVerifyResult = {valid:false}; full happy-path seq | 400 |
| 17 | 正常系 SOL | full seq + directData=profiles; mockVerifyResult={valid:true} | 200 |

**TC-17 の DB シーケンス**（実装時に purchase/route.ts の全文を確認してシーケンスを確定すること）:
```typescript
resetMockDbSequence([
  { data: BASE_ITEM },                                       // 1: get item
  { data: null },                                            // 2: no confirmed purchase
  { data: null },                                            // 3: tx_hash unused
  // 4: profiles は directData で制御
  { data: { id: "new-tx", status: "pending", tx_hash: VALID_TX, created_at: "..." } }, // 5: insert
  // 追加クエリがあれば実装時に確認して追記
]);
mockDb.directData = [
  { id: BASE_ITEM.seller_id, wallet_address: "seller_wallet_addr" },
  { id: "test-user-id", wallet_address: "buyer_wallet_addr" },
];
resetMockRpc(); // confirm_transaction → { data: null, error: null }
```

---

### Step 3: `verify-transaction.test.ts` — 18 テストケース

```
tests/unit/solana/verify-transaction.test.ts
```

**Connection モックのパターン**:

`verify-transaction.ts` は `getConnection()` を `@/lib/solana/connection` から取得する。`@/lib/solana/connection` をキャッシュ注入でモックし、その後 `verify-transaction` を `require()` する。

```typescript
// テスト用の mutable なモック状態
let mockStatusResult: unknown = null;
let mockTxResult: unknown = null;

before(() => {
  const connPath = resolveAlias("@/lib/solana/connection");
  injectModule(connPath, {
    getConnection: () => ({
      getSignatureStatuses: async () => ({ value: [mockStatusResult] }),
      getTransaction: async () => mockTxResult,
    }),
  });
  // connection をモックした後で verify-transaction をロード
  const mod = require("@/lib/solana/verify-transaction");
  isValidSolanaTxHash = mod.isValidSolanaTxHash;
  verifySolanaPurchaseTransaction = mod.verifySolanaPurchaseTransaction;
});

after(() => {
  clearModule("@/lib/solana/connection");
  clearModule("@/lib/solana/verify-transaction");
  clearModule("@/lib/solana/payment"); // payment も connection を使う場合
});
```

**テストケース一覧**:

| TC | 対象 | 入力 | 期待 |
|---|---|---|---|
| 01 | isValidSolanaTxHash | 87文字 valid Base58 | true |
| 02 | isValidSolanaTxHash | 88文字 valid Base58 | true |
| 03 | isValidSolanaTxHash | 86文字 | false |
| 04 | isValidSolanaTxHash | `"fake_tx_hash_should_fail"` | false |
| 05 | isValidSolanaTxHash | 空文字 | false |
| 06 | verifySolana | expectedAmount = 0 | {valid: false} |
| 07 | verifySolana | getSignatureStatuses → null status | {valid: false} |
| 08 | verifySolana | status.err が non-null | {valid: false} |
| 09 | verifySolana | confirmationStatus = "processed" | {valid: false} |
| 10 | verifySolana | getTransaction → null | {valid: false} |
| 11 | verifySolana | blockTime = null | {valid: false} |
| 12 | verifySolana | blockTime が現在より 3700秒前（古い） | {valid: false} |
| 13 | verifySolana | expectedSender と accountKeys[0] が不一致 | {valid: false} |
| 14 | verifySolana | SOL 正常系（recipient の残高差分 ≥ expected） | {valid: true} |
| 15 | verifySolana | SOL 金額不足（postBalance - preBalance < expected） | {valid: false} |
| 16 | verifySolana | recipient が accountKeys に含まれない | {valid: false} |
| 17 | verifySolana | USDC 正常系（token balance 差分 ≥ expected） | {valid: true} |
| 18 | verifySolana | USDC 金額不足 | {valid: false} |

**注意**: `getUsdcMint()` も `@/lib/solana/payment` から取得されるため、USDC テスト時は payment モジュールも適切に扱うこと（payment が connection を使う場合は同様にキャッシュに注入する）。

---

### Step 4: `retry.test.ts` — 11 テストケース

```
tests/unit/webhooks/retry.test.ts
```

**dispatchWebhook モックのパターン**:

```typescript
let dispatchImpl: (sub: unknown, payload: unknown) => Promise<{ success: boolean; error?: string; statusCode?: number }>;

before(() => {
  const dispatchPath = resolveAlias("@/lib/webhooks/dispatch");
  injectModule(dispatchPath, {
    dispatchWebhook: async (sub: unknown, payload: unknown) => dispatchImpl(sub, payload),
  });
  const mod = require("@/lib/webhooks/retry");
  dispatchWithRetry = mod.dispatchWithRetry;
});
```

**テストケース一覧**:

| TC | 状況 | mockDispatchImpl | 期待（call 回数） |
|---|---|---|---|
| 01 | 1回目で成功 | → success:true | 1回 |
| 02 | ssrf_rejected（永続エラー） | → error:"ssrf_rejected" | 1回 |
| 03 | decrypt_failed | → error:"decrypt_failed" | 1回 |
| 04 | no_signing_secret | → error:"no_signing_secret" | 1回 |
| 05 | HTTP 400（永続） | → statusCode:400 | 1回 |
| 06 | HTTP 403 | → statusCode:403 | 1回 |
| 07 | HTTP 404 | → statusCode:404 | 1回 |
| 08 | timeout（一時エラー）→ 最大リトライ | always → error:"timeout" | 4回（初回+3回） |
| 09 | HTTP 429 → リトライ → 成功 | 1回失敗→成功 | 2回 |
| 10 | HTTP 503 → リトライ | always → statusCode:503 | 4回 |
| 11 | dns_error → リトライ | 2回失敗→成功 | 3回 |

**実際のリトライ delay**（1s, 2s, 4s）がテスト速度に影響する場合、`dispatchWithRetry` の実装が `delayMs` 等のオーバーライドパラメータを受け入れるか確認する。受け入れない場合は TC-08/10 に `--timeout 20000` を個別設定するか、`maxRetries: 1` で検証するように調整する。

---

### Step 5: `.env.test.example` の作成

```
# .env.test.example
# コピーして .env.test を作成し実際の値を設定（git コミット禁止）
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
WEBHOOK_SIGNING_KEY=<64-char-hex>
KM_API_KEY=km_<test-key>
KM_BASE_URL=http://127.0.0.1:3000
WEBHOOK_TEST_URL=https://webhook.site/<uuid>
DEVNET_BUYER_KEYPAIR=.keys/devnet-buyer.json
DEVNET_SELLER_KEYPAIR=.keys/devnet-seller.json
```

---

### Step 6: staging テスト（15.2）のスキップパターン

```typescript
// tests/staging/*.staging.test.ts 共通
before(function () {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("SKIP: SUPABASE_SERVICE_ROLE_KEY not set");
    this.skip(); // Mocha の this.skip() → exit 0 相当
  }
});
```

### Step 7: devnet E2E スクリプト（15.3）のスキップパターン

```javascript
// scripts/e2e/devnet-purchase-flow.mjs 冒頭
const required = ["KM_API_KEY", "DEVNET_BUYER_KEYPAIR"];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.log(`SKIP: Missing env vars: ${missing.join(", ")}`);
  process.exit(0); // CI セーフ
}
```

---

## package.json scripts 追加

```json
"test:staging": "TS_NODE_PROJECT=tsconfig.test.json TS_CONFIG_PATHS=true ts-mocha 'tests/staging/**/*.staging.test.ts' --timeout 30000",
"test:e2e:devnet": "node --env-file=.env.test scripts/e2e/devnet-purchase-flow.mjs",
"test:webhook:connectivity": "node --env-file=.env.test scripts/e2e/webhook-connectivity.mjs"
```

---

## 実装順序

1. `tests/integration/helpers/supabase-mock.ts` を拡張（Step 1）
2. `tests/integration/purchase.integration.test.ts` 作成（Step 2）— 購入ルートの全文を読んでから実装
3. `tests/unit/solana/verify-transaction.test.ts` 作成（Step 3）
4. `tests/unit/webhooks/retry.test.ts` 作成（Step 4）
5. `.env.test.example` / `.gitignore` / `package.json` 修正（Step 5-7）
6. `scripts/staging/seed.mjs` / `tests/staging/*.ts` 作成
7. `scripts/devnet/` / `scripts/e2e/devnet-purchase-flow.mjs` 作成
8. `scripts/e2e/webhook-connectivity.mjs` 作成

---

## 手動ステップ（コードで実施不可）

- Supabase staging プロジェクト作成（ダッシュボードで手動）
- スキーマ・マイグレーションの staging 適用（`supabase db push --linked`）
- devnet ウォレットアドレスの `.env.test` への記載
- webhook.site で受信 URL 取得

---

## 検証方法

```bash
# モックベーステスト（CI 常時実行）
npm run test:unit        # verify-transaction + retry の新規テストを含む
npm run test:integration  # purchase.integration.test.ts の17ケースを含む
npm run test:e2e:fake-tx  # 既存テストが引き続き通ることを確認

# staging テスト（.env.test 設定後）
source .env.test && npm run test:staging

# devnet E2E（devnet 環境準備後）
node scripts/devnet/generate-wallets.mjs
node scripts/devnet/faucet.mjs
npm run test:e2e:devnet

# Webhook 疎通確認
npm run test:webhook:connectivity
```
