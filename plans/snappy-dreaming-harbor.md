# Phase 9: 信頼・品質基盤 — 実装計画

## Context

Phase 8 までで基盤(出品/決済/メタデータ/コードベース整理)が完成。
Phase 9 は「信頼性」と「開発者体験」を強化し、エージェント自律購入デモの品質を上げるフェーズ。

## スコープ (3タスク)

| # | タスク | 概要 |
|---|--------|------|
| 9.1 | 売り手信頼スコア | `profiles.trust_score` — feedbacks/ratings/sales/followers から自動算出 |
| 9.2 | ナレッジバージョニング | `knowledge_item_versions` テーブル — 編集時にスナップショット保存 |
| 9.3 | エージェント向け SDK | `sdk/` — TypeScript SDK + OpenClaw 統合サンプル |

## 戦略: 並列 3 ワーカー (タスク3件)

- 9.1 と 9.2 は独立 → 並列実装可
- 9.3 は 9.1/9.2 の API 確定後に着手

---

## 9.1 売り手信頼スコア

### マイグレーション
**ファイル**: `supabase/migrations/20260221000014_phase9_trust_score.sql`

- `ALTER TABLE profiles ADD COLUMN trust_score DECIMAL(3,2) DEFAULT 0.0 CHECK (0.0-1.0)`
- `recalculate_trust_score(seller_id)` PL/pgSQL 関数:
  - usefulness_avg x 0.35 + rating_norm x 0.30 + sales_norm x 0.20 + follower_norm x 0.15
- トリガー: `knowledge_feedbacks` INSERT/UPDATE 後 + `follows` INSERT/DELETE 後
- 既存データ一括再計算

### 型定義
- `src/types/database.types.ts`: `Profile` に `trust_score: number | null`
- `src/types/knowledge.types.ts`: `sort_by` に `"trust_score"` 追加

### ライブラリ
- `src/lib/rankings/queries.ts`: `TopSeller` に `trust_score` 追加、SELECT 拡張

### API
- `src/app/api/v1/knowledge/route.ts` (GET): `sort_by=trust_score` 対応、seller SELECT に `trust_score` 追加
- `src/lib/knowledge/queries.ts`: seller SELECT に `trust_score` 追加

### UI
- `src/components/features/SellerCard.tsx`: 信頼度バッジ表示 (>=0.8 緑, >=0.5 黄)
- `src/components/features/SellerRankingCard.tsx`: スコア表示追加

### MCP/CLI
- `mcp/src/tools.ts`: `km_search` の sort_by に `trust_score` 追加、検索結果に信頼度表示
- `cli/bin/km.mjs`: search 結果に trust_score 列追加

---

## 9.2 ナレッジバージョニング

### マイグレーション
**ファイル**: `supabase/migrations/20260221000015_phase9_versioning.sql`

```sql
CREATE TABLE knowledge_item_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  -- スナップショット
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  preview_content TEXT,
  price_sol DECIMAL(18,9),
  price_usdc DECIMAL(18,6),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB,
  full_content TEXT,
  -- 変更情報
  changed_by UUID NOT NULL REFERENCES profiles(id),
  change_summary TEXT CHECK (char_length(change_summary) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(knowledge_item_id, version_number)
);
```

- RLS: seller は全バージョン読取可、購入者もメタデータ読取可
- `get_next_version_number()` 関数

### 型定義
- `src/types/database.types.ts`: `KnowledgeItemVersion` インターフェース追加

### ライブラリ
**新規**: `src/lib/knowledge/versions.ts`
- `getVersionHistory(knowledgeItemId, limit)` — 一覧取得 (full_content 除外)
- `getVersionById(knowledgeItemId, versionNumber)` — 特定バージョン取得
- `createVersionSnapshot({knowledgeItemId, changedBy, changeSummary})` — 編集前にスナップショット保存

### 統合ポイント
- `PATCH /api/v1/knowledge/[id]`: 更新前に `createVersionSnapshot` 呼び出し
- Server Action `updateListing`: 同上

### API
**新規**: `src/app/api/v1/knowledge/[id]/versions/route.ts`
- `GET /api/v1/knowledge/[id]/versions` — 売り手 or 購入者のみ

### UI
**新規**: `src/components/features/VersionHistory.tsx`
- ナレッジ詳細ページにバージョン履歴タブ追加

### MCP
- `mcp/src/tools.ts`: `km_get_version_history` ツール追加

### CLI
- `cli/bin/km.mjs`: `km versions <id> [--json]` コマンド追加

---

## 9.3 エージェント向け TypeScript SDK

### 構造
```
sdk/
  package.json          # @knowledge-market/sdk
  tsconfig.json
  src/
    index.ts            # re-export
    client.ts           # KnowledgeMarketClient クラス
    types.ts            # 公開型
    errors.ts           # KmApiError
    internal/
      api.ts            # mcp/src/api.ts ベースの HTTP クライアント
  examples/
    basic-usage.ts
    openclaw-integration.ts
  README.md
```

### KnowledgeMarketClient API
- `search(params)` — ナレッジ検索
- `getItem(id)` — 詳細取得
- `getContent(id)` — コンテンツ取得 (購入済み)
- `recordPurchase({knowledgeId, txHash, token})` — 購入記録
- `getVersionHistory(id)` — バージョン履歴
- `publish({title, description, contentType, content, price})` — 出品

### 設計方針
- 外部依存ゼロ (Node.js 18+ の `fetch` 使用)
- `mcp/src/api.ts` のコードを `sdk/src/internal/api.ts` にコピー (将来的に共有パッケージ化)
- Python SDK は Phase 10 以降に先送り

---

## 実装順序

```
Step 1 (並列):
  [Worker A] 9.1 マイグレーション → 型 → ライブラリ → API → UI → MCP/CLI
  [Worker B] 9.2 マイグレーション → 型 → ライブラリ → API → UI → MCP/CLI

Step 2 (直列):
  [Worker C] 9.3 SDK (9.1/9.2 API 確定後)
```

## 変更対象ファイル一覧

### 新規作成
- `supabase/migrations/20260221000014_phase9_trust_score.sql`
- `supabase/migrations/20260221000015_phase9_versioning.sql`
- `src/lib/knowledge/versions.ts`
- `src/app/api/v1/knowledge/[id]/versions/route.ts`
- `src/components/features/VersionHistory.tsx`
- `sdk/` ディレクトリ一式

### 既存変更
- `src/types/database.types.ts` — Profile に trust_score、KnowledgeItemVersion 追加
- `src/types/knowledge.types.ts` — sort_by 拡張
- `src/lib/rankings/queries.ts` — TopSeller に trust_score
- `src/lib/knowledge/queries.ts` — seller SELECT に trust_score
- `src/app/api/v1/knowledge/route.ts` — sort_by=trust_score
- `src/app/api/v1/knowledge/[id]/route.ts` — PATCH にバージョン保存統合
- `src/components/features/SellerCard.tsx` — 信頼度バッジ
- `src/components/features/SellerRankingCard.tsx` — スコア表示
- `mcp/src/tools.ts` — km_search 拡張 + km_get_version_history 追加
- `cli/bin/km.mjs` — versions コマンド + search 表示拡張

## 検証方法

1. マイグレーション適用: `npx supabase db push` → テーブル/トリガー確認
2. trust_score: フィードバック INSERT → profiles.trust_score 変化確認
3. バージョニング: PATCH /knowledge/[id] → versions テーブルにレコード確認
4. SDK: `sdk/examples/basic-usage.ts` を `tsx` で実行
5. `npm run build` 通過
6. `npm run lint` 通過

## リスク

| リスク | 対策 |
|--------|------|
| trust_score トリガーの負荷 | 最小スコープで実装、負荷観測後に最適化 |
| バージョン full_content のストレージ | 当面はスナップショット、将来 diff 保存に移行 |
| SDK と MCP の api.ts コード重複 | YAGNI で許容、将来共有パッケージ化 |
| sort_by=trust_score のメモリソート | per_page 上限 100 件で許容範囲 |
