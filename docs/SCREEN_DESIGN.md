# KnowMint — 画面設計・仕様書

> 最終更新: 2026-02-23 (Phase 27 購入フロー完了 / Phase 23 セキュリティ硬化 / Phase 15 テスト完了)

---

## 目次

1. [ページ構成](#1-ページ構成)
2. [コンポーネント仕様](#2-コンポーネント仕様)
3. [API Routes](#3-api-routes)
4. [型定義](#4-型定義)
5. [主要機能フロー](#5-主要機能フロー)
6. [セキュリティ機構](#6-セキュリティ機構)
7. [コンテンツタイプ・リスティングタイプ](#7-コンテンツタイプリスティングタイプ)
8. [データフロー図](#8-データフロー図)

---

## 1. ページ構成

### 認証関連

| URLパス | ファイルパス | 機能 | 認証 |
|---------|------------|------|------|
| `/login` | `src/app/(auth)/login/page.tsx` | メール・パスワード認証 | 不要 |
| `/signup` | `src/app/(auth)/signup/page.tsx` | 新規ユーザー登録（user_type: human/agent） | 不要 |

### メインサイト

| URLパス | ファイルパス | 機能 | 主要コンポーネント |
|---------|------------|------|-----------------|
| `/` | `src/app/(main)/page.tsx` | ホームページ（新着・人気・カテゴリ・TOP売上者） | `KnowledgeCard`, `RecommendationSection`, `SellerRankingCard` |
| `/search` | `src/app/(main)/search/page.tsx` | 検索・フィルタリング | `SearchBar`, `KnowledgeCard` |
| `/knowledge/[id]` | `src/app/(main)/knowledge/[id]/page.tsx` | ナレッジ詳細・購入 | `PurchaseSection`, `ReviewList`, `ContentPreview`, `SellerCard` |
| `/library` | `src/app/(main)/library/page.tsx` | 購入済みコンテンツ一覧 | リスト表示 |
| `/library/[id]` | `src/app/(main)/library/[id]/page.tsx` | 購入済みコンテンツ詳細・ダウンロード | `ContentPreview` |
| `/category/[slug]` | `src/app/(main)/category/[slug]/page.tsx` | カテゴリ別表示 | `KnowledgeCard` |
| `/profile` | `src/app/(main)/profile/page.tsx` | プロフィール編集（display_name, bio） | `Input`, `Textarea` |
| `/rankings` | `src/app/(main)/rankings/page.tsx` | 出品者ランキング Top20 | `SellerRankingCard` |
| `/favorites` | `src/app/(main)/favorites/page.tsx` | お気に入り一覧 | `KnowledgeCard` |
| `/notifications` | `src/app/(main)/notifications/page.tsx` | 通知一覧 | 通知アイコン・リスト |
| `/terms` | `src/app/(main)/terms/page.tsx` | 利用規約 | 静的ページ |
| `/privacy` | `src/app/(main)/privacy/page.tsx` | プライバシーポリシー | 静的ページ |
| `/legal` | `src/app/(main)/legal/page.tsx` | 特商法・消費者保護法表示 | 静的ページ |
| `/contact` | `src/app/(main)/contact/page.tsx` | お問い合わせ | フォーム |

### 出品・リスト管理

| URLパス | ファイルパス | 機能 | ステップ |
|---------|------------|------|--------|
| `/list` | `src/app/(main)/list/page.tsx` | 新規出品フォーム | 4ステップ（基本情報 → コンテンツ → 価格 → 確認） |
| `/list/[id]/edit` | `src/app/(main)/list/[id]/edit/page.tsx` | 出品編集フォーム | 同上 |

### ダッシュボード

| URLパス | ファイルパス | 機能 | 内容 |
|---------|------------|------|------|
| `/dashboard` | `src/app/(main)/dashboard/page.tsx` | 統計ダッシュボード | 出品数・公開中・売上 Stats Card |
| `/dashboard/listings` | `src/app/(main)/dashboard/listings/page.tsx` | 出品管理 | 出品一覧（draft/published/archived/suspended） |
| `/dashboard/purchases` | `src/app/(main)/dashboard/purchases/page.tsx` | 購入履歴 | テーブル表示（金額・チェーン・ステータス・TX） |
| `/dashboard/sales` | `src/app/(main)/dashboard/sales/page.tsx` | 売上管理 | 売上統計・グラフ |
| `/dashboard/rankings` | `src/app/(main)/dashboard/rankings/page.tsx` | ランキング | ダッシュボード内ランキング |
| `/dashboard/favorites` | `src/app/(main)/dashboard/favorites/page.tsx` | お気に入り | ダッシュボード内お気に入り |
| `/dashboard/api-keys` | `src/app/(main)/dashboard/api-keys/page.tsx` | APIキー管理 | キー生成・削除・権限管理 |
| `/dashboard/settings` | `src/app/(main)/dashboard/settings/page.tsx` | 設定 | ウォレット接続・言語・テーマ |

---

## 2. コンポーネント仕様

### UI コンポーネント（`src/components/ui/`）

#### `Button.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `variant` | `primary \| secondary \| outline \| ghost \| danger` | 見た目 |
| `size` | `sm \| md \| lg` | サイズ |
| `loading` | `boolean` | ローディング状態 |
| `disabled` | `boolean` | 無効状態 |
| `className` | `string` | 追加クラス |

#### `Card.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `children` | `ReactNode` | 子要素 |
| `className` | `string` | 追加クラス |
| `padding` | `sm \| md \| lg` | p-3 / p-4 / p-6 |
| `hover` | `boolean` | ホバーエフェクト |

#### `Badge.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `variant` | `success \| warning \| error \| info \| default` | バリアント |
| `children` | `ReactNode` | テキスト |

#### `Modal.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `isOpen` | `boolean` | 表示状態 |
| `onClose` | `() => void` | 閉じるハンドラ |
| `title` | `string` | タイトル |
| `children` | `ReactNode` | 子要素 |

その他: `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Spinner.tsx`

---

### レイアウトコンポーネント（`src/components/layout/`）

#### `Header.tsx`
- ロゴ、ナビゲーション、検索バー、ユーザーメニュー
- `WalletButton`, `NotificationBell` を含む
- モバイルメニュー対応

#### `Footer.tsx`
- リンク、コピーライト

#### `Sidebar.tsx`
- ダッシュボード内サイドナビゲーション

---

### 機能コンポーネント（`src/components/features/`）

#### `KnowledgeCard.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `id` | `string` | ナレッジID |
| `listing_type` | `ListingType` | offer/request |
| `title` | `string` | タイトル |
| `description` | `string` | 説明 |
| `content_type` | `ContentType` | コンテンツ種別 |
| `price_sol` | `number \| null` | SOL価格 |
| `price_usdc` | `number \| null` | USDC価格 |
| `seller` | `ProfileRef` | 出品者情報 |
| `category` | `CategoryRef \| null` | カテゴリ |
| `tags` | `string[]` | タグ |
| `average_rating` | `number \| null` | 平均評価 |
| `purchase_count` | `number` | 購入数 |

表示内容: バッジ（listing_type・content_type）、タグ、価格、評価

#### `PurchaseSection.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `knowledgeId` | `string` | ナレッジID |
| `title` | `string` | タイトル |
| `priceSol` | `number \| null` | SOL価格 |
| `priceUsdc` | `number \| null` | USDC価格 |
| `sellerWallet` | `string \| null` | 売り手ウォレット |
| `isRequest` | `boolean` | リクエスト型か |

機能: 購入ボタン管理、`PurchaseModal` の開閉、`recordPurchase` Server Action 呼び出し

#### `PurchaseModal.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `isOpen` | `boolean` | 表示状態 |
| `onClose` | `() => void` | 閉じるハンドラ |
| `title` | `string` | ナレッジタイトル |
| `priceSol` | `number \| null` | SOL価格 |
| `priceUsdc` | `number \| null` | USDC価格 |
| `sellerWallet` | `string` | 売り手ウォレットアドレス |
| `onPurchaseComplete` | `(txHash, chain, token) => Promise<void>` | 購入完了コールバック |

機能:
- Solana チェーン: SOL 直接送金 または Smart Contract 経由、USDC (SPL Token, 6 decimals)
- EVM チェーン: 未実装（UI では無効化・案内表示）
- 利用規約チェック、ウォレット接続確認
- TX ハッシュ取得 → `recordPurchase` → DB 記録

#### `ContentPreview.tsx`
- 購入者向けコンテンツ表示
- RLS: `knowledge_item_contents` アクセス制御

#### `RecommendationSection.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `title` | `string` | セクションタイトル |
| `items` | `SupabaseKnowledgeRow[]` | ナレッジ一覧 |

#### `SellerCard.tsx`
- 出品者プロフィール、trust_score、フォローボタン

#### `SellerRankingCard.tsx`
- ランキングカード（順位・出品者名・売上・件数）

#### `ReviewForm.tsx`
- 評価（1-5 星）・コメント投稿フォーム
- `submitReview` Server Action

#### `ReviewList.tsx`
- レビュー一覧表示

#### `FavoriteButton.tsx`
- ハート型お気に入りボタン

#### `FollowButton.tsx`
- フォロー・アンフォローボタン

#### `SearchBar.tsx`
- 検索入力フォーム（`/search` へ遷移）

#### `NotificationBell.tsx`
- 通知ベルアイコン + ドロップダウン

#### `VersionHistory.tsx`
- バージョン履歴表示（`change_summary`）

#### `ApiKeyManager.tsx`
- APIキー生成・表示・削除・権限管理

#### `ChainSelector.tsx`
- Solana / Base / Ethereum のチェーン選択

#### `WalletButton.tsx`
- Solana Phantom/Solflare ウォレット接続

#### `EVMWalletButton.tsx`
- EVM MetaMask/Coinbase Wallet 接続

---

### 出品フォームコンポーネント（`src/components/features/ListingForm/`）

#### `BasicInfoStep.tsx`
- `listing_type` (offer/request) 選択
- title, description, category, tags, metadata 入力

#### `ContentEditor.tsx`
- listing_type に応じて UI が切り替わる
  - **offer**: `preview_content`, `full_content`
  - **request**: `needed_info`, `background`, `delivery_conditions`, `notes`

#### `PricingStep.tsx`
- `price_sol`, `price_usdc`, `seller_disclosure` 入力

#### `PreviewStep.tsx`
- 最終確認・公開ボタン

---

### ダッシュボードコンポーネント（`src/components/dashboard/`）

#### `StatsCard.tsx`
| Prop | 型 | 説明 |
|------|-----|------|
| `label` | `string` | ラベル |
| `value` | `string \| number` | メイン値 |
| `subValue` | `string` | サブ値 |
| `icon` | `ReactNode` | アイコン |
| `iconColor` | `blue \| green \| purple \| amber` | アイコン色 |
| `trend` | `number` | トレンド（%） |

#### `SalesChart.tsx`
- 売上グラフ表示（日次/月次）

#### `DashboardNav.tsx`
- ダッシュボード内ナビゲーション

---

## 3. API Routes

ベースパス: `/api/v1/`
全ルートに `withApiAuth` HOC 適用: IP レート制限 → APIキー認証 (SHA-256) → パーミッション検査 → キー別レート制限

### 認証・ウォレット

| メソッド | パス | 機能 |
|---------|------|------|
| `GET` | `/api/v1/me/wallet/challenge` | SIWS チャレンジ発行（署名メッセージ生成） |
| `POST` | `/api/v1/me/wallet/verify` | Ed25519 署名検証 → DB wallet_address 関連付け |
| `POST` | `/api/v1/keys` | APIキー生成（SHA-256 ハッシュ保存） |
| `GET` | `/api/v1/keys` | APIキー一覧取得 |
| `DELETE` | `/api/v1/keys/[id]` | APIキー削除 |

### Knowledge

| メソッド | パス | 機能 |
|---------|------|------|
| `GET` | `/api/v1/knowledge` | 一覧取得（検索・フィルタ・ページネーション） |
| `POST` | `/api/v1/knowledge` | 新規出品作成（status: draft） |
| `GET` | `/api/v1/knowledge/[id]` | 詳細取得（seller, category joined） |
| `PATCH` | `/api/v1/knowledge/[id]` | 出品編集 |
| `DELETE` | `/api/v1/knowledge/[id]` | 出品削除 |
| `POST` | `/api/v1/knowledge/[id]/publish` | draft → published |
| `GET` | `/api/v1/knowledge/[id]/preview` | preview_content 取得（購入前） |
| `GET` | `/api/v1/knowledge/[id]/content` | 完全コンテンツ取得（x402 対応） |
| `GET` | `/api/v1/knowledge/[id]/versions` | バージョン履歴取得 |
| `POST` | `/api/v1/knowledge/[id]/feedback` | 購入者フィードバック |
| `POST` | `/api/v1/knowledge/[id]/purchase` | TX 検証 + DB 記録 |
| `GET` | `/api/v1/knowledge/batch` | 複数アイテム一括取得（UUID_RE バリデーション） |
| `POST` | `/api/v1/knowledge/[id]/dataset/upload-url` | S3 署名付き Upload URL 発行 |
| `POST` | `/api/v1/knowledge/[id]/dataset/finalize` | アップロード完了確認 |

**GET `/api/v1/knowledge` クエリパラメータ:**

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `query` | `string` | - | 全文検索 |
| `category` | `string` | - | カテゴリスラッグ |
| `content_type` | `ContentType` | - | コンテンツ種別 |
| `listing_type` | `ListingType` | - | offer/request |
| `min_price` | `number` | - | 最低価格（SOL） |
| `max_price` | `number` | - | 最高価格（SOL） |
| `sort_by` | `newest \| popular \| price_low \| price_high \| rating \| trust_score` | `newest` | 並び順 |
| `metadata_domain` | `string` | - | 専門分野フィルタ |
| `metadata_experience_type` | `string` | - | 経験タイプフィルタ |
| `metadata_applicable_to` | `string` | - | 適用先フィルタ |
| `metadata_source_type` | `string` | - | ソースタイプフィルタ |
| `page` | `number` | `1` | ページ番号 |
| `per_page` | `number` | `20` | 1ページ件数（max: 100） |

### Favorites

| メソッド | パス | 機能 |
|---------|------|------|
| `GET` | `/api/v1/favorites` | お気に入り一覧 |
| `POST` | `/api/v1/favorites` | お気に入り追加（UUID_RE バリデーション） |
| `DELETE` | `/api/v1/favorites/[id]` | お気に入り削除（UUID_RE バリデーション） |

### Transactions

| メソッド | パス | 機能 |
|---------|------|------|
| `GET` | `/api/v1/transactions/[id]` | Transaction 詳細取得 |
| `GET` | `/api/v1/me/purchases` | 購入履歴（knowledge_item joined） |

### Webhook・通知

| メソッド | パス | 機能 |
|---------|------|------|
| `POST` | `/api/v1/webhooks` | Webhook エンドポイント登録 |
| `PATCH` | `/api/v1/webhooks/[id]` | Webhook 更新 |
| `GET` | `/api/v1/webhooks/[id]` | Webhook 詳細 |
| `DELETE` | `/api/v1/webhooks/[id]` | Webhook 削除 |
| `POST` | `/api/v1/webhooks/[id]/regenerate` | Secret キーを再生成 |

### その他

| メソッド | パス | 機能 |
|---------|------|------|
| `GET` | `/api/v1/categories` | カテゴリ一覧（id, name, slug, icon） |
| `POST` | `/api/v1/me/listings` | ユーザーの出品一覧 |
| `GET` | `/api/cron/cleanup-pending-tx` | pending TX 自動クリーンアップ |

---

## 4. 型定義

### データベース型（`src/types/database.types.ts`）

```typescript
type ContentType  = "prompt" | "tool_def" | "dataset" | "api" | "general";
type UserType     = "human" | "agent";
type ListingType  = "offer" | "request";
type KnowledgeStatus    = "draft" | "published" | "archived" | "suspended";
type TransactionStatus  = "pending" | "confirmed" | "failed" | "refunded";
type Chain  = "solana" | "base" | "ethereum";
type Token  = "SOL" | "USDC" | "ETH";

interface Profile {
  id: string;
  display_name: string | null;
  user_type: UserType;
  avatar_url: string | null;
  wallet_address: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  trust_score: number | null;
  created_at: string;
  updated_at: string;
}

interface KnowledgeItem {
  id: string;
  seller_id: string;
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  price_sol: number | null;
  price_usdc: number | null;
  preview_content: string | null;
  category_id: string | null;
  tags: string[];
  status: KnowledgeStatus;
  view_count: number;
  purchase_count: number;
  average_rating: number | null;
  metadata: KnowledgeItemMetadata | null;
  usefulness_score: number | null;
  seller_disclosure: string | null;
  created_at: string;
  updated_at: string;
}

interface KnowledgeItemContent {
  id: string;
  knowledge_item_id: string;
  full_content: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  buyer_id: string;
  seller_id: string;
  knowledge_item_id: string;
  amount: number;
  token: Token;
  chain: Chain;
  tx_hash: string;
  status: TransactionStatus;
  protocol_fee: number | null;
  fee_vault_address: string | null;
  created_at: string;
  updated_at: string;
}

interface Review {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  knowledge_item_id: string;
  rating: number;       // 1-5
  comment: string | null;
  created_at: string;
  updated_at: string;
}

interface Notification {
  id: string;
  user_id: string;
  type: "purchase" | "review" | "follow" | "new_listing";
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;       // SHA-256 ハッシュ（平文不保存）
  name: string;
  permissions: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

interface Favorite {
  id: string;
  user_id: string;
  knowledge_item_id: string;
  created_at: string;
}
```

### フォーム・ドメイン型（`src/types/knowledge.types.ts`）

```typescript
interface KnowledgeFormData {
  title: string;
  description: string;
  listing_type: ListingType;
  content_type: ContentType;
  price_sol: number | null;
  price_usdc: number | null;
  preview_content: string;
  full_content: string;
  file: File | null;
  category_id: string;
  tags: string[];
  metadata: KnowledgeMetadataForm;
}

interface KnowledgeMetadataForm {
  domain: string;
  experience_type: string;
  applicable_to: string[];
  source_type: string;
}

interface KnowledgeWithSeller extends KnowledgeItem {
  seller: Pick<Profile, "id" | "display_name" | "avatar_url" | "trust_score">;
  category: Pick<Category, "id" | "name" | "slug"> | null;
}

interface KnowledgeSearchParams {
  query?: string;
  category?: string;
  content_type?: ContentType;
  listing_type?: ListingType;
  min_price?: number;
  max_price?: number;
  sort_by?: "newest" | "popular" | "price_low" | "price_high" | "rating" | "trust_score";
  page?: number;
  per_page?: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  prompt:   "テキスト・記事",
  tool_def: "テンプレート・設定",
  dataset:  "データ・資料",
  api:      "リンク・外部リソース",
  general:  "その他ナレッジ",
};

const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  offer:   "出品",
  request: "募集",
};
```

---

## 5. 主要機能フロー

### 5.1 出品フロー

```
/list ページ
  │
  ├─ ステップ 1: 基本情報 (BasicInfoStep)
  │  ├─ listing_type 選択 (offer/request)
  │  ├─ title, description, category, tags, metadata
  │
  ├─ ステップ 2: コンテンツ (ContentEditor)
  │  ├─ offer  → preview_content, full_content
  │  └─ request → needed_info, background, delivery_conditions, notes
  │
  ├─ ステップ 3: 価格 (PricingStep)
  │  └─ price_sol, price_usdc, seller_disclosure
  │
  ├─ ステップ 4: 確認 (PreviewStep)
  │  └─ publishListing() Server Action
  │     └─ POST /api/v1/knowledge/[id]/publish
  │        └─ status: draft → published
  │
  └─ /dashboard/listings へリダイレクト
```

**Server Actions:**
- `createListing()` — 新規 draft 作成 (`POST /api/v1/knowledge`)
- `updateListing()` — draft 更新 (`PATCH /api/v1/knowledge/[id]`)
- `publishListing()` — draft → published (`POST /api/v1/knowledge/[id]/publish`)
- `deleteListing()` — 削除 (`DELETE /api/v1/knowledge/[id]`)

---

### 5.2 購入フロー

```
/knowledge/[id] ページ
  │
  └─ PurchaseSection → "購入する" ボタン
     │
     └─ PurchaseModal 表示
        │
        ├─ ウォレット接続確認
        ├─ チェーン・トークン選択 (Solana のみ有効)
        ├─ 利用規約チェック
        │
        ├─ TX 作成・署名
        │  ├─ SOL: buildSolTransfer() or buildSmartContractPurchase()
        │  └─ USDC: buildSmartContractPurchaseSpl() (SPL, 6 decimals)
        │
        ├─ sendTransaction() で Solana 署名・送信
        │
        └─ onPurchaseComplete(txHash, chain, token)
           └─ recordPurchase() Server Action
              ├─ verifySolanaPurchaseTransaction() で TX 検証
              ├─ transactions 挿入 (status: "pending")
              ├─ 23505 unique violation → 再 SELECT で冪等性チェック
              └─ confirm_transaction RPC → status: "confirmed"

完了後: モーダルクローズ → /library で閲覧可能
```

---

### 5.3 コンテンツ閲覧フロー（購入者）

```
/library → /library/[id]
  │
  ├─ hasAccess() チェック
  │  └─ seller_id === user.id
  │     OR transactions に confirmed レコードが存在
  │
  ├─ knowledge_item_contents.full_content 取得
  │
  └─ ContentPreview 表示
     ├─ テキスト: 直接表示
     └─ dataset: 署名付き Download URL
```

---

### 5.4 x402 HTTP Payment Protocol フロー

```
GET /api/v1/knowledge/[id]/content
  │
  ├─ 出品者 or 購入者確認済み → 200 OK + content
  │
  ├─ X-PAYMENT ヘッダなし & 未購入
  │  └─ 402 Payment Required
  │     ├─ x402Version: 1
  │     ├─ accepts: ["exact"]
  │     └─ price (SOL/USDC)
  │
  └─ X-PAYMENT ヘッダあり
     ├─ parseXPaymentHeader() → txHash, scheme, token, amount
     ├─ verifySolanaPurchaseTransaction()
     ├─ amount と DB price 一致確認
     └─ 合致 → 200 OK + content
```

---

### 5.5 ウォレット登録フロー（SIWS）

```
/dashboard/settings
  │
  └─ "ウォレット接続" ボタン
     │
     ├─ GET /api/v1/me/wallet/challenge
     │  └─ SIWS メッセージ生成
     │     ├─ "KnowMint wants you to sign in..."
     │     ├─ statement: "I agree to the Terms of Service"
     │     └─ nonce, issued_at, expiration_time
     │
     ├─ ユーザーが署名（Ed25519）
     │
     ├─ POST /api/v1/me/wallet/verify
     │  ├─ メッセージ + 署名を検証
     │  └─ consume_wallet_challenge RPC 呼び出し
     │
     └─ profiles.wallet_address を更新
```

---

### 5.6 APIキー管理フロー

```
/dashboard/api-keys
  │
  ├─ "新規キー生成"
  │  └─ POST /api/v1/keys
  │     ├─ キー文字列生成
  │     ├─ SHA-256 ハッシュ化
  │     └─ DB 保存（平文は1回のみ表示後に破棄）
  │
  ├─ キー一覧 → GET /api/v1/keys
  │
  └─ キー削除 → DELETE /api/v1/keys/[id]
```

---

## 6. セキュリティ機構

### 認証・認可
| 機構 | 説明 |
|------|------|
| Supabase Auth | メール・パスワード認証 |
| RLS (Row Level Security) | DB レベルのアクセス制御 |
| API キー (SHA-256) | 平文不保存、ハッシュのみ |
| SIWS | Solana ウォレット署名検証 |
| `withApiAuth` HOC | IP rate limit → APIキー → パーミッション → キー別 rate limit |

### コンテンツ分離
| テーブル | 内容 | アクセス |
|---------|------|---------|
| `knowledge_items` | メタ情報 + `preview_content` | 全ユーザー |
| `knowledge_item_contents` | `full_content` | 購入者・出品者のみ（RLS） |

### トランザクション処理
- **冪等性**: Unique constraint + 23505 時に再 SELECT で成否判定
- **TX 検証**: Solana RPC で実際の送金確認 (`verifySolanaPurchaseTransaction`)
- **Status フロー**: `pending` → `confirmed` → `accessed`

### HTTP セキュリティヘッダ（`next.config.ts`）
- HSTS
- X-Frame-Options
- CSP（`unsafe-eval` 除去）
- Referrer-Policy
- Permissions-Policy

---

## 7. コンテンツタイプ・リスティングタイプ

### コンテンツタイプ

| DB 値 | UI ラベル | 説明 | 例 |
|-------|---------|------|-----|
| `prompt` | テキスト・記事 | プロンプト文、ハウツー記事 | ChatGPT プロンプト集 |
| `tool_def` | テンプレート・設定 | ツール定義、設定ファイル | Claude MCP 設定 |
| `dataset` | データ・資料 | CSV/JSON データセット | 業界統計データ |
| `api` | リンク・外部リソース | API ドキュメント、リソースリンク | OpenAPI スキーマ |
| `general` | その他ナレッジ | 上記に当てはまらない知識 | 汎用 |

### リスティングタイプ

| DB 値 | UI ラベル | 説明 | 購入可否 |
|-------|---------|------|--------|
| `offer` | 出品 | 売り手が知識を提供 | 可 |
| `request` | 募集 | 買い手が知識を募集 | 不可（コメント・反応のみ） |

---

## 8. データフロー図

```
User (Browser)
  │
  ├─ Pages (Server/Client Components)
  │  ├─ /knowledge/[id]   → getKnowledgeById() + getRecommendations()
  │  ├─ /dashboard        → getDashboardStats() + getRecentTransactions()
  │  └─ /list             → createListing() / publishListing() Server Actions
  │
  ├─ API Routes (src/app/api/v1/)
  │  ├─ GET  /knowledge          → getPublishedKnowledge() (paginated)
  │  ├─ POST /knowledge/[id]/purchase → verifySolanaPurchaseTransaction()
  │  └─ GET  /knowledge/[id]/content  → hasAccess() check + x402
  │
  └─ Supabase
     ├─ Auth
     ├─ DB Tables
     │  ├─ profiles
     │  ├─ knowledge_items
     │  ├─ knowledge_item_contents   ← RLS で保護
     │  ├─ transactions
     │  ├─ reviews
     │  ├─ notifications
     │  ├─ api_keys
     │  ├─ favorites
     │  └─ wallet_challenges
     ├─ RLS Policies
     ├─ Storage Buckets: datasets
     └─ RPC Functions
        ├─ confirm_transaction
        ├─ consume_wallet_challenge
        ├─ increment_view_count
        ├─ increment_purchase_count
        ├─ update_average_rating
        └─ recalculate_trust_score
```

---

## 9. Supabase クライアント使い分け

| クライアント | ファイル | 用途 | RLS |
|------------|---------|------|-----|
| Browser | `lib/supabase/client.ts` | Client Components | 適用 |
| Server | `lib/supabase/server.ts` | RSC, Server Actions | 適用 |
| Admin | `lib/supabase/admin.ts` | API Routes のみ | **バイパス** |

> API Routes では Admin クライアントで RLS をバイパスし、`withApiAuth` 内で手動認可する。

---

## 10. デプロイ構成

| 環境 | プラットフォーム | ブランチ |
|------|---------------|--------|
| 本番 | Cloudflare Workers | `main` push |
| プレビュー | Cloudflare Workers | PR 作成時 |
| ローカル | Next.js dev server | - |

### 環境変数

```bash
NEXT_PUBLIC_SUPABASE_URL=...          # Supabase プロジェクト URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # Supabase Anon Key
SUPABASE_SERVICE_ROLE_KEY=...         # Admin クライアント用
NEXT_PUBLIC_SOLANA_RPC_URL=...        # Solana RPC
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```
