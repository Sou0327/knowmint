# @knowledge-market/sdk

TypeScript SDK for the Knowledge Market API.

人間の暗黙知・体験知をAIエージェントに販売するナレッジマーケットプレイスの TypeScript クライアントライブラリです。

## 特徴

- **外部依存ゼロ**: Node.js 18+ ネイティブの `fetch` を使用
- **型安全**: 完全な TypeScript 型定義
- **シンプルな API**: 検索・詳細取得・購入記録・出品を数行で実装可能

## インストール

```bash
# npm
npm install @knowledge-market/sdk

# pnpm
pnpm add @knowledge-market/sdk

# bun
bun add @knowledge-market/sdk
```

## クイックスタート

```typescript
import { KnowledgeMarketClient } from "@knowledge-market/sdk";

const client = new KnowledgeMarketClient({
  apiKey: process.env.KM_API_KEY!,
  baseUrl: "https://your-knowledge-market.example.com",
});

// ナレッジを検索
const results = await client.search({ query: "prompt engineering" });
console.log(`Found ${results.pagination.total} items`);

for (const item of results.data) {
  console.log(`- ${item.title} (${item.price_sol} SOL)`);
}

// 詳細を取得
const detail = await client.getItem(results.data[0].id);
console.log(detail.preview_content);
```

## API リファレンス

### `new KnowledgeMarketClient(options)`

クライアントを初期化します。

| オプション | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `apiKey` | `string` | はい | — | Knowledge Market API キー (`km_<64 hex>`) |
| `baseUrl` | `string` | いいえ | `http://127.0.0.1:3000` | API ベース URL |
| `timeoutMs` | `number` | いいえ | `30000` | リクエストタイムアウト (ms) |

### `client.search(params)`

ナレッジを検索します。

```typescript
const results = await client.search({
  query: "React performance",
  content_type: "prompt",
  sort_by: "trust_score",
  max_results: 10,
  metadata_domain: "web-development",
});
// => SearchResult { data: KnowledgeItem[], pagination: Pagination }
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `query` | `string?` | 全文検索クエリ |
| `content_type` | `ContentType?` | `prompt` / `tool_def` / `dataset` / `api` / `general` |
| `sort_by` | `string?` | `newest` / `popular` / `price_low` / `price_high` / `rating` / `trust_score` |
| `max_results` | `number?` | 最大取得件数 |
| `metadata_domain` | `string?` | メタデータ: ドメインでフィルタ |
| `metadata_experience_type` | `string?` | メタデータ: 体験タイプでフィルタ |
| `metadata_source_type` | `string?` | メタデータ: ソースタイプでフィルタ |

### `client.getItem(id)`

ナレッジアイテムの詳細を取得します。

```typescript
const item = await client.getItem("item-uuid");
// => KnowledgeItem (seller プロフィール付き)
```

### `client.getContent(id)`

購入済みナレッジのフルコンテンツを取得します。未購入の場合は `KmApiError` (status: 403) が発生します。

```typescript
const content = await client.getContent("item-uuid");
console.log(content.full_content);
console.log(content.file_url); // ファイルがある場合
```

### `client.recordPurchase(input)`

オンチェーン購入のトランザクションを記録します。実際の SOL/トークン送金は事前にオンチェーンで行ってください。

```typescript
const purchase = await client.recordPurchase({
  knowledgeId: "item-uuid",
  txHash: "5JkQ...", // オンチェーントランザクションハッシュ
  token: "SOL",      // SOL / USDC / ETH
  chain: "solana",   // solana / base / ethereum
});
// => PurchaseResult
```

### `client.getVersionHistory(id)`

ナレッジのバージョン履歴を取得します。

```typescript
const versions = await client.getVersionHistory("item-uuid");
for (const v of versions) {
  console.log(`v${v.version_number}: ${v.change_summary}`);
}
// => KnowledgeVersion[]
```

### `client.publish(input)`

ナレッジを下書き作成して即時公開します。

```typescript
const item = await client.publish({
  title: "React Hooks の最適化パターン",
  description: "実務で培った useCallback / useMemo の正しい使い方",
  content_type: "prompt",
  content: "フルコンテンツ...",
  price_sol: 0.1,
  tags: ["react", "hooks", "performance"],
});
// => KnowledgeItem (published)
```

## エラーハンドリング

```typescript
import { KnowledgeMarketClient, KmApiError } from "@knowledge-market/sdk";

try {
  const item = await client.getItem("nonexistent-id");
} catch (err) {
  if (err instanceof KmApiError) {
    console.error(`API Error [${err.status}]: ${err.message}`);
    // err.status: HTTPステータスコード (404, 403 など)
    // err.code:   APIエラーコード (文字列)
  }
}
```

## OpenClaw 統合例

OpenClaw AI エージェントが Knowledge Market SDK を使ってナレッジを自律的に検索・購入するサンプルは [`examples/openclaw-integration.ts`](./examples/openclaw-integration.ts) を参照してください。

```typescript
import { KnowledgeMarketClient } from "@knowledge-market/sdk";

const client = new KnowledgeMarketClient({ apiKey: process.env.KM_API_KEY! });

// エージェントのナレッジ獲得フロー
async function acquireKnowledge(topic: string, maxBudgetSol: number) {
  // 1. 信頼スコア順で検索
  const results = await client.search({ query: topic, sort_by: "trust_score" });

  // 2. 予算内のアイテムを選定
  const candidate = results.data.find(
    (item) => item.price_sol !== null && item.price_sol <= maxBudgetSol
  );
  if (!candidate) return null;

  // 3. オンチェーン送金後に記録
  const purchase = await client.recordPurchase({
    knowledgeId: candidate.id,
    txHash: "on_chain_tx_hash",
  });

  // 4. フルコンテンツを取得
  return client.getContent(candidate.id);
}
```

## ライセンス

MIT
