# Phase 20.4: x402 エージェント自律購入デモ — E2E テスト実装計画

## Context

Phase 20 で x402 プロトコル互換の HTTP 402 ゲートが content route に実装済み (`cc:DONE`)。
しかし **テストが一切ない**。Phase 20.4 では以下を追加して mainnet 前のテスト基盤を整える。

- **統合テスト (mock-based)**: CI で毎回回る。`content/route.ts` の x402 ゲート全分岐をカバー
- **E2E smoke script**: `npm run dev` 起動中のサーバーに実リクエストを投げ、402 フォーマットを確認

---

## 完成後のフロー (実装済み)

```
エージェント: km_get_content(id)
→ MCP → GET /api/v1/knowledge/{id}/content
→ API: 402 { x402Version:1, accepts:[{scheme,network,maxAmountRequired,payTo,...}] }
→ エージェント: SOL 送金 → tx_hash 取得
→ km_get_content(id, payment_proof: base64(JSON({scheme,network,payload:{txHash,asset}})))
→ MCP → GET /content + X-PAYMENT ヘッダー
→ API: verifySolanaPurchaseTransaction() → 200 + content
```

---

## 実装対象

### 1. `tests/integration/helpers/supabase-mock.ts` に追加

#### 1-A. `createTableQueuedMockAdminClient(tableQueues)`

現行の `createMockAdminClient()` は全テーブルで `mockDb.singleData` を共有するため、
content route のように同テーブルを複数回呼ぶルート（profiles を seller/buyer で並列取得）に対応できない。
**per-table キューで個別の応答を返す新モック**を追加する。

```typescript
type QueueEntry = {
  data: unknown;
  error?: { code?: string; message?: string } | null;
};

export function createTableQueuedMockAdminClient(
  tableQueues: Record<string, QueueEntry[]>
): { from: (tableName: string) => Record<string, unknown> }
```

- `.from("tableName")` 呼び出し時点でキューから先頭を pop する
- `.single()` / `.maybeSingle()` / direct await のいずれでも同じ entry を返す
- `insert()` 等のノープメソッドは自身を返すチェーンを維持

#### 1-B. `mockVerifyTx` + `mockSolana` 状態オブジェクト

```typescript
export const mockVerifyTx = {
  result: { valid: true } as { valid: boolean; error?: string },
};

export const mockSolana = {
  isValidHash: true,  // isValidSolanaTxHash の戻り値を制御
};
```

#### 1-C. `setupContentMocks()` / `teardownContentMocks()`

注入対象モジュール:
- `@/lib/api/response` — 既存 `responseMockExports`
- `@/lib/api/middleware` — 既存 `buildWithApiAuthMock()`
- `@/lib/supabase/admin` — `createTableQueuedMockAdminClient` を返す factory
- `@/lib/audit/log` — noop
- `next/server` — `NextResponse.json` を `new Response(JSON.stringify(body), init)` に差し替え
- `@/lib/solana/verify-transaction` — `mockVerifyTx.result` / `mockSolana.isValidHash` を返す
- `@/lib/storage/datasets` — `createDatasetSignedDownloadUrl: async () => null`
- `@/lib/x402` — **実モジュールをそのまま使用**（ユーティリティのみ、副作用なし）

`teardownContentMocks()` では上記 + `@/app/api/v1/knowledge/[id]/content/route` のキャッシュを削除。

---

### 2. `tests/integration/content.integration.test.ts` (新規作成)

Mocha + Chai (`ts-mocha`)。`setupContentMocks()` で注入 → `require()` でルートロード → 各テスト。

#### テストシナリオ (11件)

**describe: no X-PAYMENT ヘッダー**

| # | 条件 | 期待 |
|---|------|------|
| 1 | item.status = "draft" | 404 |
| 2 | published, 非購入者・非seller | **402** + `x402Version:1` + `accepts[]` ≥ 1件 |
| 3 | published, seller 本人 | 200 + `{full_content, file_url}` |
| 4 | published, confirmed purchase あり | 200 + content |

**describe: X-PAYMENT ヘッダーあり (x402 flow)**

| # | 条件 | 期待 |
|---|------|------|
| 5 | base64 decode できない不正ヘッダー | 402 + `error` フィールドあり |
| 6 | 不正 tx hash 形式 (短すぎる) | 402 + `error` フィールドあり |
| 7 | buyer wallet 未設定 (buyerResult.data = null) | 400 |
| 8 | `verifySolanaPurchaseTransaction` が `valid:false` | 402 + `error:"Payment verification failed"` |
| 9 | 有効支払い (verify=valid) | 200 + content (transactions.insert が呼ばれる) |
| 10 | 同一 tx_hash・同一 buyer・同一 item → 既に confirmed | 200 (idempotent) |
| 11 | 同一 tx_hash だが buyer/item 不一致 | 409 conflict |

#### DB キュー設定例 (シナリオ 9 — 有効支払い)

```typescript
mockTables = {
  knowledge_items: [{ data: publishedItem }],        // (1) item fetch
  transactions:    [{ data: null }],                  // (2) existingTx check → none
  profiles:        [{ data: { wallet_address: "SellerWallet..." } },   // (3a) seller
                    { data: { wallet_address: "BuyerWallet..." } }],   // (3b) buyer
  // verifySolanaPurchaseTransaction → mockVerifyTx.result = { valid: true }
  // transactions insert → (4) queued as { data: null, error: null }
  knowledge_item_contents: [{ data: { full_content: "secret", file_url: null } }],
};
// transactions に insert 用エントリも追加
mockTables.transactions.push({ data: null, error: null });
```

---

### 3. `scripts/e2e/x402-flow-check.mjs` (新規作成)

E2E smoke test。`npm run dev` で起動した実サーバーに hit する。

```
必須環境変数: KM_API_KEY
任意環境変数: KM_BASE_URL (default: http://127.0.0.1:3000)
              KM_TEST_KNOWLEDGE_ID
```

**検証項目**:

1. `GET /content` with no X-PAYMENT → status 402 + `x402Version:1` + `accepts` is Array
2. `GET /content` with malformed X-PAYMENT (`"invalid-base64!"`) → status 402 + `error` フィールドあり

**helper 関数**:
```javascript
function buildTestXPayment(txHash) {
  return Buffer.from(JSON.stringify({
    scheme: "exact",
    network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    payload: { txHash, asset: "native" }
  })).toString("base64");
}
```

---

### 4. `package.json` に追加

```json
"test:e2e:x402-flow": "node scripts/e2e/x402-flow-check.mjs"
```

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `tests/integration/helpers/supabase-mock.ts` | **修正** | `createTableQueuedMockAdminClient`, `mockVerifyTx`, `mockSolana`, `setupContentMocks`, `teardownContentMocks` を追加 |
| `tests/integration/content.integration.test.ts` | **新規** | 11テストシナリオ (Mocha+Chai) |
| `scripts/e2e/x402-flow-check.mjs` | **新規** | E2E smoke test (running server 対象) |
| `package.json` | **修正** | `test:e2e:x402-flow` スクリプト追加 |

**変更なし**:
- `src/lib/x402/index.ts` — 実モジュールをそのまま使用
- `src/app/api/v1/knowledge/[id]/content/route.ts` — 実装済み、修正不要

---

## 参照する既存コード

| 関数/ファイル | 用途 |
|-------------|------|
| `tests/integration/helpers/supabase-mock.ts:104` | `createMockAdminClient` パターンを `createTableQueuedMockAdminClient` で拡張 |
| `tests/integration/helpers/supabase-mock.ts:209` | `setupKeysMocks` のモジュール注入パターンを踏襲 |
| `tests/integration/webhooks.integration.test.ts` | describe/it/before/after の構造パターン |
| `scripts/e2e/fake-tx-purchase-check.mjs` | E2E スクリプトの構造・環境変数パターン |
| `src/lib/x402/index.ts:114` | `parseXPaymentHeader` — テスト用 X-PAYMENT ヘッダー生成の逆操作で使用 |
| `src/app/api/v1/knowledge/[id]/content/route.ts` | DB クエリ順序・分岐確認済み |

---

## 検証方法

### 統合テスト (CI で自動実行)
```bash
npm run test:integration
# content.integration.test.ts が含まれることを確認
```

### E2E smoke test
```bash
npm run dev &
KM_API_KEY=<your_key> KM_TEST_KNOWLEDGE_ID=<published_id> npm run test:e2e:x402-flow
# PASS: ... と表示されることを確認
```

### 手動 curl 確認
```bash
# 402 確認
curl -s -H "Authorization: Bearer $KM_API_KEY" \
  http://localhost:3000/api/v1/knowledge/$ID/content | jq '.x402Version'
# → 1

# 不正ヘッダー確認
curl -s -H "Authorization: Bearer $KM_API_KEY" \
  -H "X-PAYMENT: not-valid-base64!!" \
  http://localhost:3000/api/v1/knowledge/$ID/content | jq '.error'
# → "Invalid X-PAYMENT header"
```
