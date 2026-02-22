# Phase 22: ソース全体リファクタリング — 実装計画

## Context

Phase 14〜21 の Codex レビューで蓄積された品質・セキュリティ課題を一括解消する。
機能追加は一切行わず、コードの正確性・一貫性・保守性向上のみを目的とする。
優先順位: 22.1 (CRITICAL/HIGH) → 22.2 → 22.3 → 22.4 → 22.5 → 22.6

---

## 22.1 セキュリティ修正 (CRITICAL/HIGH)

### 対象ファイル

#### A. `src/app/api/v1/knowledge/[id]/purchase/route.ts`

**変更1: ウォレットアドレスのフォーマット検証 (L160-162)**
```
// Before (L160-162)
const sellerWallet = walletProfiles.find((p) => p.id === item.seller_id)?.wallet_address;
const buyerWallet = walletProfiles.find((p) => p.id === user.userId)?.wallet_address;

// After: canonical PublicKey 検証を追加
import { PublicKey } from "@solana/web3.js";

const rawSellerWallet = walletProfiles.find((p) => p.id === item.seller_id)?.wallet_address;
const rawBuyerWallet = walletProfiles.find((p) => p.id === user.userId)?.wallet_address;

// PublicKey.toBase58() で canonical 形式に変換（不正フォーマットは例外 → 500 返却）
let sellerWallet: string | undefined;
let buyerWallet: string | undefined;
try {
  sellerWallet = rawSellerWallet ? new PublicKey(rawSellerWallet).toBase58() : undefined;
  buyerWallet = rawBuyerWallet ? new PublicKey(rawBuyerWallet).toBase58() : undefined;
} catch {
  return apiError(API_ERRORS.INTERNAL_ERROR, "Invalid wallet address format");
}
```
※ `PublicKey` は既にファイル内でインポート済み (L4 付近) かを確認し、未インポートなら追加。

**変更2: ネスト Promise reject handler 漏れ (L259-280)**
```
// Before: .then(success, error) パターン — success 内例外を捕捉しない
admin
  .from("knowledge_items")
  .select("id, title")
  .eq("id", id)
  .single()
  .then(
    ({ data: itemData }) => { ... },
    (err: unknown) => console.error(...)
  );

// After: .then(success).catch(error) パターンに統一
admin
  .from("knowledge_items")
  .select("id, title")
  .eq("id", id)
  .single()
  .then(({ data: itemData }) => {
    if (itemData) {
      notifyPurchase(
        item.seller_id,
        "購入者",
        { id: itemData.id, title: itemData.title },
        expectedAmount,
        token
      ).catch((err: unknown) =>
        console.error("Failed to send purchase notification:", err)
      );
    }
  })
  .catch((err: unknown) =>
    console.error("Failed to fetch item for notification:", err)
  );
```

#### B. `src/app/api/v1/webhooks/route.ts`

**変更: webhook secret 暗号化失敗を warn → error (L128-129)**
```
// Before
console.warn("WEBHOOK_SIGNING_KEY not configured; webhook signing disabled:", err);

// After
console.error("[webhooks] WEBHOOK_SIGNING_KEY not configured; webhook signing disabled:", err);
```

#### C. `src/app/api/v1/knowledge/[id]/feedback/route.ts`

**変更: seller_id チェック追加 (L37-48)**
```
// Before
const { data: tx, error: txError } = await supabase
  .from("transactions")
  .select("id")
  .eq("buyer_id", user.userId)
  .eq("knowledge_item_id", id)
  .eq("status", "confirmed")
  .maybeSingle();

// After: 出品者が自分のアイテムにフィードバックできないよう seller_id を排除
const { data: tx, error: txError } = await supabase
  .from("transactions")
  .select("id")
  .eq("buyer_id", user.userId)
  .eq("knowledge_item_id", id)
  .eq("status", "confirmed")
  .neq("seller_id", user.userId)
  .maybeSingle();
```

---

## 22.2 命名規則統一 (snake_case → camelCase)

### 対象ファイル: `src/app/api/v1/knowledge/route.ts`

GET ハンドラのローカル変数を全て camelCase に変換。DB フィールド名 (snake_case) はそのまま維持し、変数名のみ変更する。

| Before | After |
|--------|-------|
| `content_type` | `contentType` |
| `listing_type` | `listingType` |
| `min_price_raw` | `minPriceRaw` |
| `min_price` | `minPrice` |
| `max_price_raw` | `maxPriceRaw` |
| `max_price` | `maxPrice` |
| `sort_by` | `sortBy` |
| `per_page` | `perPage` |
| `metadata_domain` | `metadataDomain` |
| `metadata_experience_type` | `metadataExperienceType` |
| `metadata_applicable_to` | `metadataApplicableTo` |
| `metadata_source_type` | `metadataSourceType` |

また、型 cast を validation 後に行う (L47-49 付近):
```
// Before: 検証前に cast
const content_type = contentTypeRaw as ContentType | undefined;

// After: まず変数に受け取り、検証後にキャスト
const contentTypeRaw = searchParams.get("content_type") ?? undefined;
// ... (Zod や enum チェックで検証) ...
const contentType = contentTypeRaw as ContentType | undefined;
```

---

## 22.3 型安全性改善

### A. `src/lib/supabase/admin.ts` (L3)

```typescript
// Before
const globalForAdmin = globalThis as unknown as { __supabaseAdminClient?: SupabaseClient };

// After: declare を使った module augmentation
declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdminClient: SupabaseClient | undefined;
}
const globalForAdmin = globalThis as typeof globalThis & { __supabaseAdminClient?: SupabaseClient };
```

### B. `src/lib/api/rate-limit.ts` (L51)

```typescript
// Before
const g = globalThis as unknown as { __rateLimitCleanup?: ReturnType<typeof setInterval> };

// After
declare global {
  // eslint-disable-next-line no-var
  var __rateLimitCleanup: ReturnType<typeof setInterval> | undefined;
}
const g = globalThis as typeof globalThis & { __rateLimitCleanup?: ReturnType<typeof setInterval> };
```

### C. `src/lib/recommendations/queries.ts` (L98)

```typescript
// Before
const item = p.knowledge_item as unknown;
const categoryId = (item as { category_id?: string }).category_id;
const tags = (item as { tags?: string[] }).tags;

// After: 型ガード関数で置換
interface KnowledgeItemRef {
  category_id?: string;
  tags?: string[];
}
function isKnowledgeItemRef(val: unknown): val is KnowledgeItemRef {
  return typeof val === "object" && val !== null;
}
const itemRef = p.knowledge_item;
const categoryId = isKnowledgeItemRef(itemRef) ? itemRef.category_id : undefined;
const tags = isKnowledgeItemRef(itemRef) && Array.isArray(itemRef.tags) ? itemRef.tags : undefined;
```

---

## 22.4 エラーロギング標準化

統一フォーマット: `console.error("[<route>] <action> failed:", { userId?, resourceId?, error })`

### 対象ファイル一覧

- `src/app/api/v1/knowledge/route.ts`
- `src/app/api/v1/knowledge/[id]/content/route.ts`
- `src/app/api/v1/knowledge/[id]/purchase/route.ts`
- `src/app/api/v1/knowledge/[id]/feedback/route.ts`
- `src/app/api/v1/webhooks/route.ts`

例 (purchase/route.ts):
```
// Before
console.error("Failed to fetch wallet profiles:", walletError);

// After
console.error("[purchase] fetch wallet profiles failed:", { userId: user.userId, error: walletError });
```

### `src/lib/audit/log.ts` — metadata サイズ上限追加

```typescript
// Before: INSERT 前にサイズチェックなし

// After: INSERT 前に 2048 bytes 上限チェック
const metadataStr = JSON.stringify(params.metadata ?? {});
const metadata = metadataStr.length > 2048
  ? { _truncated: true, _original_size: metadataStr.length }
  : (params.metadata ?? {});
// 上記 metadata を INSERT に使用
```

---

## 22.5 不要依存の削除

```bash
npm uninstall @metamask/sdk
```

- `@metamask/sdk` はソースコード内に import が一切ない (MetaMask は wagmi 経由で対応済み)
- `package.json` から `"@metamask/sdk": "^0.33.1"` が削除される

---

## 22.6 大ファイル分割 (低優先)

### A. `src/app/api/v1/knowledge/route.ts` (362行)

GET ハンドラのクエリビルダ部分を `buildKnowledgeListQuery()` ヘルパーに抽出。
同ファイル内か `src/lib/knowledge/query-builder.ts` に定義。

### B. `src/components/dashboard/ApiKeyManager.tsx` (359行)

`KeyGenerator`, `KeyDisplay`, `KeyList` サブコンポーネントに分割。
`src/components/dashboard/api-key/` ディレクトリに配置。

---

## 実装順序

1. **22.1** (security 優先) — `purchase/route.ts`, `webhooks/route.ts`, `feedback/route.ts`
2. **22.2** — `knowledge/route.ts` (変数名リネーム)
3. **22.3** — `admin.ts`, `rate-limit.ts`, `recommendations/queries.ts`
4. **22.4** — 全 API route のエラーログ統一 + `audit/log.ts` メタデータ上限
5. **22.5** — `npm uninstall @metamask/sdk`
6. **22.6** (任意) — ファイル分割

各ステップ完了後に `npm run build` でビルド確認。
全完了後に Codex レビュー (ISSUES_FOUND: 0 になるまでループ)。

---

## 検証方法

```bash
# ビルド検証
npm run build

# ユニット・統合テスト
npm run test:unit
npm run test:integration

# Lint
npm run lint
```

Codex レビュー:
```
mcp__codex__codex で Security/Performance/Quality レビュー
→ critical/high は必ず修正、ISSUES_FOUND: 0 になるまでループ
```

---

## 変更ファイル一覧

| ファイル | 変更種別 | セクション |
|--------|---------|----------|
| `src/app/api/v1/knowledge/[id]/purchase/route.ts` | セキュリティ修正 | 22.1 |
| `src/app/api/v1/webhooks/route.ts` | セキュリティ修正 | 22.1 |
| `src/app/api/v1/knowledge/[id]/feedback/route.ts` | セキュリティ修正 | 22.1 |
| `src/app/api/v1/knowledge/route.ts` | 命名規則 + ロギング | 22.2, 22.4 |
| `src/app/api/v1/knowledge/[id]/content/route.ts` | ロギング | 22.4 |
| `src/lib/supabase/admin.ts` | 型安全性 | 22.3 |
| `src/lib/api/rate-limit.ts` | 型安全性 | 22.3 |
| `src/lib/recommendations/queries.ts` | 型安全性 | 22.3 |
| `src/lib/audit/log.ts` | メタデータ上限 | 22.4 |
| `package.json` | 依存削除 | 22.5 |
| `src/components/dashboard/ApiKeyManager.tsx` | 分割 (任意) | 22.6 |
