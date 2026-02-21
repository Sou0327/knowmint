# Phase 5.1: ユーザーダッシュボード実装計画

## Context

Phase 1-4 完了済み。ダッシュボード関連で既に存在するページ:
- `/dashboard/listings` — 出品管理 (基本CRUD)
- `/library` — 購入済み一覧
- `/profile` — プロフィール編集

**不足**: 統一ダッシュボードレイアウト、売上分析、APIキー管理UI

## 新規ファイル一覧

```
src/app/(main)/dashboard/
  layout.tsx              # ダッシュボードレイアウト (サイドバー付き)
  page.tsx                # 概要ページ (統計サマリー)
  sales/page.tsx          # 売上分析ページ
  purchases/page.tsx      # 購入履歴 (→ /library 統合)
  api-keys/page.tsx       # APIキー管理
  settings/page.tsx       # 設定 (→ /profile 統合)

src/components/dashboard/
  DashboardNav.tsx        # サイドバーナビゲーション
  StatsCard.tsx           # 統計カード (再利用可能)
  SalesChart.tsx          # 売上チャート (recharts)
  ApiKeyManager.tsx       # APIキーCRUD

src/lib/dashboard/
  queries.ts              # ダッシュボード用Supabaseクエリ

src/types/
  dashboard.types.ts      # ダッシュボード用型定義
```

## 実装ステップ (7タスク)

### Task 1: 基盤 — 型定義 + クエリ関数

**ファイル**: `src/types/dashboard.types.ts`, `src/lib/dashboard/queries.ts`

型定義:
```typescript
DashboardStats { totalListings, publishedCount, draftCount, totalRevenue: {SOL, USDC}, totalSales }
SalesByDate { date: string, amount: number, token: Token }
RevenueByToken { token: Token, total: number, count: number }
TopSellingItem { id, title, salesCount, revenue, averageRating }
```

クエリ関数 (Supabase server client 使用):
- `getDashboardStats(userId)` — knowledge_items count by status + transactions sum by token (30日)
- `getRecentTransactions(userId, limit)` — 直近の取引一覧
- `getSalesByDateRange(userId, start, end)` — 日別売上
- `getTopSellingItems(userId, limit)` — 売上上位アイテム

### Task 2: DashboardNav + Layout

**ファイル**: `src/components/dashboard/DashboardNav.tsx`, `src/app/(main)/dashboard/layout.tsx`

DashboardNav:
- クライアントコンポーネント (`usePathname` で active 判定)
- ナビ項目: 概要, 出品管理, 売上分析, 購入履歴, APIキー, 設定
- レスポンシブ: デスクトップ=左サイドバー、モバイル=上部タブ or ハンバーガー

Layout:
- 認証チェック (`getUser()`, 未認証は `/login` リダイレクト)
- `<DashboardNav>` + `{children}` の2カラム構成

### Task 3: StatsCard コンポーネント

**ファイル**: `src/components/dashboard/StatsCard.tsx`

再利用可能な統計表示カード:
- Props: `{ label, value, subValue?, icon?, trend? }`
- 既存 `Card` コンポーネントをラップ
- ダークモード対応

### Task 4: 概要ページ (Dashboard Home)

**ファイル**: `src/app/(main)/dashboard/page.tsx`

サーバーコンポーネント:
- `getDashboardStats()` で統計取得
- `getRecentTransactions()` で直近5件取得
- StatsCard x 4 (出品数, 公開中, 売上(SOL), 売上(USDC))
- 直近の取引リスト
- クイックアクション: 新規出品, 売上分析へ

### Task 5: 売上分析ページ + SalesChart

**ファイル**: `src/app/(main)/dashboard/sales/page.tsx`, `src/components/dashboard/SalesChart.tsx`

**依存**: `recharts` パッケージ追加 (`npm install recharts`)

クライアントコンポーネント:
- 期間選択 (7日, 30日, 90日, 全期間)
- 日別売上推移チャート (BarChart / LineChart)
- トークン別収益内訳
- トップセラーアイテムテーブル
- `getSalesByDateRange()`, `getTopSellingItems()` をクライアント側で呼び出し

### Task 6: APIキー管理ページ

**ファイル**: `src/app/(main)/dashboard/api-keys/page.tsx`, `src/components/dashboard/ApiKeyManager.tsx`

クライアントコンポーネント:
- 既存 API routes 利用: `GET/POST/DELETE /api/v1/keys`
- キー一覧 (名前, 権限, 作成日, 最終使用日)
- 新規作成フォーム (名前, 権限チェックボックス: read/write/admin)
- 作成時のみフルキー表示 + コピーボタン
- 削除確認ダイアログ (既存 Modal 使用)
- 使用方法の説明セクション

**注意**: API routes は Supabase admin client を使用しているため、ブラウザからは直接 Supabase を叩かず、既存 API routes (`/api/v1/keys`) を `fetch` で呼ぶ。ただし既存 API routes は API key (Bearer token) 認証のため、ブラウザから呼べない。**対策**: Supabase クライアントで `api_keys` テーブルを直接操作する (RLS がユーザー自身のキーのみ許可済み)。キー生成ロジックは `src/lib/api/auth.ts` の `generateApiKey()` を再利用。

### Task 7: リダイレクトページ + Header更新

**ファイル**:
- `src/app/(main)/dashboard/purchases/page.tsx` — `/library` へ redirect
- `src/app/(main)/dashboard/settings/page.tsx` — `/profile` へ redirect
- `src/components/layout/Header.tsx` — 「ダッシュボード」リンク追加

## 既存ファイルの変更

| ファイル | 変更内容 |
|---------|---------|
| `src/components/layout/Header.tsx` | ナビに「ダッシュボード」リンク追加 |
| `package.json` | `recharts` 追加 |
| `src/app/(main)/dashboard/listings/page.tsx` | ステータスフィルタータブ追加 (minor) |

## 再利用する既存コード

| 既存コード | パス | 用途 |
|-----------|------|------|
| `Card`, `Button`, `Badge`, `Modal`, `Input` | `src/components/ui/` | 全ページ |
| `createClient` (browser) | `src/lib/supabase/client.ts` | クライアント側クエリ |
| `createClient` (server) | `src/lib/supabase/server.ts` | サーバー側クエリ |
| `getUser` | `src/lib/auth/session.ts` | 認証チェック |
| `useAuth` | `src/contexts/AuthContext.tsx` | ユーザー情報取得 |
| `CONTENT_TYPE_LABELS`, `STATUS_LABELS` | `src/types/knowledge.types.ts` | ラベル表示 |
| `generateApiKey` | `src/lib/api/auth.ts` | APIキー生成 |
| `deleteListing`, `publishListing` | `src/app/(main)/list/actions.ts` | 出品操作 |

## 検証方法

1. `npm run build` — ビルド成功確認
2. `npm run dev` でブラウザ確認:
   - `/dashboard` — 統計が表示される
   - `/dashboard/listings` — 既存機能 + フィルタ動作
   - `/dashboard/sales` — チャート描画
   - `/dashboard/api-keys` — キー作成/削除
   - `/dashboard/purchases` → `/library` リダイレクト
   - `/dashboard/settings` → `/profile` リダイレクト
3. レスポンシブ確認 (モバイル幅でサイドバー挙動)
4. ダークモード確認
5. 未認証状態で `/dashboard` アクセス → `/login` リダイレクト

## 実装順序と依存関係

```
Task 1 (型+クエリ)
  ↓
Task 2 (Nav+Layout) + Task 3 (StatsCard)  ← 並列可
  ↓
Task 4 (概要ページ)
  ↓
Task 5 (売上分析)  + Task 6 (APIキー)  ← 並列可
  ↓
Task 7 (リダイレクト+Header)
```
