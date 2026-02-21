# Phase 5: ダッシュボード・拡張 - 実装計画

## Context

Phase 1-4 が完了し、Knowledge Market の基盤（認証、出品、検索、Solana決済、エージェントAPI）は動作している。Phase 5 では、ユーザーダッシュボードの完成確認、マルチチェーン決済対応、ソーシャル・ディスカバリー機能を追加する。

**重要な発見**: 5.1 ユーザーダッシュボードは既に大部分が実装済み。購入履歴ページのみ未実装（リダイレクトのみ）。

## 実装方針

- **UI 実装**: `document-skills:frontend-design` スキル必須
- **レビュー**: 各サブフェーズ完了後に Codex MCP レビュー実施
- **既存パターン踏襲**: Server Component + `src/lib/*/queries.ts` パターン

---

## Task 1: 5.1 ダッシュボード完了確認 + 購入履歴ページ

**目的**: 5.1 の実装済みタスクを確認し、唯一の未実装（購入履歴）を完成させる

### 1-1. 購入履歴ページ実装

`/dashboard/purchases` を実装（現在は `/library` へのリダイレクトのみ）

**変更ファイル**:
- `src/app/(main)/dashboard/purchases/page.tsx` — リダイレクトから実ページへ書き換え
- `src/lib/dashboard/queries.ts` — `getPurchaseHistory(userId)` 追加

**実装内容**:
- 購入日時、アイテム名、金額、トークン、tx_hash 表示
- ステータスバッジ（confirmed / pending / failed）
- アイテムへのリンク、コンテンツ閲覧リンク
- 期間フィルタ（7d / 30d / 90d / all）

**データソース**: `transactions` テーブル（`buyer_id = user.id`）+ `knowledge_items` join

### 1-2. Plans.md 更新

5.1 の全タスクを `cc:DONE` にマーク

---

## Task 2: 5.2 マルチチェーン対応 — EVM ウォレット統合

**目的**: Base / Ethereum ウォレット接続と EVM 決済フローを追加

### 2-1. パッケージインストール

```bash
npm install viem wagmi @tanstack/react-query
```

### 2-2. EVM ウォレットプロバイダー

**新規ファイル**:
- `src/contexts/EVMWalletContext.tsx` — wagmi の WagmiProvider + QueryClientProvider
- `src/lib/evm/config.ts` — wagmi config（Base, Ethereum chains, MetaMask/Coinbase Wallet connectors）

**変更ファイル**:
- `src/app/layout.tsx` — EVMWalletProvider を SolanaWalletProvider と並列で wrap
- `src/contexts/WalletContext.tsx` は Solana 専用のまま維持（名前変更なし）

### 2-3. EVM ウォレット接続 UI

**新規ファイル**:
- `src/components/features/EVMWalletButton.tsx` — MetaMask / Coinbase Wallet 接続ボタン

**変更ファイル**:
- `src/components/features/WalletButton.tsx` — 統合ウォレットボタン（Solana / EVM 切替タブ）

### 2-4. チェーン切り替え UI

**新規ファイル**:
- `src/components/features/ChainSelector.tsx` — Solana / Base / Ethereum 切り替えドロップダウン
- `src/contexts/ChainContext.tsx` — 選択中チェーンの状態管理

**変更ファイル**:
- `src/components/layout/Header.tsx` — ChainSelector を追加

### 2-5. EVM 決済フロー

**新規ファイル**:
- `src/lib/evm/payment.ts` — ETH 送金トランザクション構築（viem）
- `src/lib/evm/verify.ts` — オンチェーン検証（送信者/受取人/金額）

**変更ファイル**:
- `src/components/features/PurchaseModal.tsx` — チェーン選択に応じて Solana / EVM 決済を分岐
- `src/app/api/v1/knowledge/[id]/purchase/route.ts` — EVM tx_hash の検証ロジック追加

### 2-6. DB マイグレーション

**新規ファイル**:
- `supabase/migrations/XXX_multichain_support.sql`

```sql
-- Chain enum に既に base, ethereum が存在するため、マイグレーション不要
-- ただし、EVM tx_hash フォーマット検証の CHECK 制約追加を検討
ALTER TABLE transactions
  ADD CONSTRAINT chk_tx_hash_format
  CHECK (
    (chain = 'solana' AND tx_hash ~ '^[A-Za-z0-9]{87,88}$')
    OR (chain IN ('base', 'ethereum') AND tx_hash ~ '^0x[a-fA-F0-9]{64}$')
    OR tx_hash IS NOT NULL
  );
```

---

## Task 3: 5.3 追加機能 — お気に入り / ウォッチリスト

### 3-1. DB マイグレーション

**新規ファイル**:
- `supabase/migrations/XXX_favorites.sql`

```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, knowledge_item_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_item ON favorites(knowledge_item_id);
```

### 3-2. UI 実装

**新規ファイル**:
- `src/components/features/FavoriteButton.tsx` — ハートアイコンのトグルボタン
- `src/app/(main)/favorites/page.tsx` — お気に入り一覧ページ
- `src/lib/favorites/queries.ts` — `getFavorites(userId)`, `toggleFavorite(userId, itemId)`

**変更ファイル**:
- `src/app/(main)/knowledge/[id]/page.tsx` — FavoriteButton 追加
- `src/components/features/KnowledgeCard.tsx` — FavoriteButton 追加
- `src/components/dashboard/DashboardNav.tsx` — お気に入りリンク追加

### 3-3. API（エージェント向け）

**新規ファイル**:
- `src/app/api/v1/favorites/route.ts` — GET（一覧）/ POST（追加）/ DELETE（削除）

---

## Task 4: 5.3 追加機能 — 出品者フォロー

### 4-1. DB マイグレーション

**新規ファイル**:
- `supabase/migrations/XXX_follows.sql`

```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);
CREATE POLICY "Anyone can read follows" ON follows
  FOR SELECT USING (true);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- profiles にフォロワー数カウントカラム追加
ALTER TABLE profiles ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;

-- フォロー数自動更新トリガ
CREATE OR REPLACE FUNCTION update_follow_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = follower_count - 1 WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

### 4-2. UI 実装

**新規ファイル**:
- `src/components/features/FollowButton.tsx` — フォロー/フォロー解除ボタン
- `src/lib/follows/queries.ts` — `getFollowing(userId)`, `toggleFollow(followerId, followingId)`, `getFollowerCount(userId)`

**変更ファイル**:
- `src/components/features/SellerCard.tsx` — FollowButton 追加、フォロワー数表示
- `src/app/(main)/knowledge/[id]/page.tsx` — 出品者セクションに FollowButton 追加

---

## Task 5: 5.3 追加機能 — 通知システム

### 5-1. DB マイグレーション

**新規ファイル**:
- `supabase/migrations/XXX_notifications.sql`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'review', 'follow', 'new_listing')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- 通知作成用 RPC（SECURITY DEFINER）
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5-2. 通知トリガー（サーバーサイド）

**新規ファイル**:
- `src/lib/notifications/queries.ts` — `getNotifications(userId)`, `markAsRead(notifId)`, `getUnreadCount(userId)`
- `src/lib/notifications/create.ts` — `notifyPurchase(sellerId, item)`, `notifyReview(sellerId, item, rating)`, `notifyFollow(userId, follower)`, `notifyNewListing(followerId, seller, item)`

**変更ファイル**:
- `src/app/api/v1/knowledge/[id]/purchase/route.ts` — 購入成功時に売り手へ通知
- `src/app/api/v1/knowledge/[id]/review/route.ts`（存在すれば）— レビュー投稿時に通知
- フォロー処理 — フォロー通知

### 5-3. 通知 UI

**新規ファイル**:
- `src/components/features/NotificationBell.tsx` — ヘッダーの通知ベルアイコン（未読バッジ）
- `src/components/features/NotificationDropdown.tsx` — 通知ドロップダウン一覧
- `src/app/(main)/notifications/page.tsx` — 通知一覧ページ（全件表示）

**変更ファイル**:
- `src/components/layout/Header.tsx` — NotificationBell 追加

---

## Task 6: 5.3 追加機能 — レコメンデーション

### 6-1. レコメンドロジック

**新規ファイル**:
- `src/lib/recommendations/queries.ts`

**実装方針**: Supabase クエリベース（ML不要、シンプルに開始）
1. **同カテゴリ人気**: 閲覧中アイテムと同カテゴリの人気アイテム
2. **購入者も買った**: 同じアイテムを購入した人が買った他のアイテム
3. **タグベース**: 共通タグを持つアイテム

```typescript
export async function getRecommendations(itemId: string, limit = 6) {
  // 1. 同カテゴリの人気アイテム（purchase_count DESC）
  // 2. 共通タグ数でランク付け
  // 3. 自分自身を除外
}

export async function getPersonalRecommendations(userId: string, limit = 6) {
  // 購入履歴のカテゴリ・タグから推薦
}
```

### 6-2. UI 実装

**変更ファイル**:
- `src/app/(main)/knowledge/[id]/page.tsx` — 「関連アイテム」セクション追加（Plans.md の 2.3 未完了タスク）
- `src/app/(main)/page.tsx` — 「あなたへのおすすめ」セクション追加（認証済みユーザー向け）

**新規ファイル**:
- `src/components/features/RecommendationSection.tsx` — レコメンドアイテム横スクロール表示

---

## Task 7: 5.3 追加機能 — 出品者ランキング

### 7-1. ランキングロジック

**新規ファイル**:
- `src/lib/rankings/queries.ts`

```typescript
export async function getTopSellers(limit = 10) {
  // profiles + transactions JOIN
  // 条件: confirmed 取引のある売り手
  // ソート: 売上数、平均評価、フォロワー数の加重スコア
}
```

### 7-2. UI 実装

**新規ファイル**:
- `src/app/(main)/rankings/page.tsx` — ランキングページ
- `src/components/features/SellerRankingCard.tsx` — ランキングカード（順位、アバター、統計）

**変更ファイル**:
- `src/app/(main)/page.tsx` — トップページに「人気の出品者」セクション追加
- `src/components/dashboard/DashboardNav.tsx` — ランキングリンク追加（SECONDARY_NAV）

---

## Task 8: 型定義更新

**変更ファイル**:
- `src/types/database.types.ts` — Favorite, Follow, Notification 型追加

```typescript
export interface Favorite {
  id: string;
  user_id: string;
  knowledge_item_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'purchase' | 'review' | 'follow' | 'new_listing';
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}
```

- `src/types/wallet.types.ts` — EVM 関連型追加（ChainType, EVMChain）

---

## 実装順序と依存関係

```
Task 8 (型定義) ─────────────────────────────┐
                                              ↓
Task 1 (購入履歴) ──→ [独立]                  │
Task 2 (マルチチェーン) ──→ [独立]            │
Task 3 (お気に入り) ──→ [独立]                │
Task 4 (フォロー) ──→ [独立]                  │
Task 5 (通知) ──→ [Task 3, 4 に依存]          │
Task 6 (レコメンド) ──→ [独立]                │
Task 7 (ランキング) ──→ [Task 4 に依存]       │
```

**推奨実装順序**:
1. Task 8 → 型定義（全タスクの前提）
2. Task 1 → 購入履歴（5.1 完了に必要、最小工数）
3. Task 3 → お気に入り（シンプル、UI練習）
4. Task 4 → フォロー（お気に入りと類似パターン）
5. Task 2 → マルチチェーン（独立だが工数大）
6. Task 6 → レコメンド（クエリロジック中心）
7. Task 5 → 通知（フォロー/お気に入り完成後）
8. Task 7 → ランキング（フォロー数参照）

---

## 品質保証

### frontend-design スキル使用

以下の UI 実装時に `document-skills:frontend-design` スキルを必ず使用:
- FavoriteButton, FollowButton（インタラクティブ UI）
- NotificationBell + NotificationDropdown（ヘッダー統合）
- ChainSelector, EVMWalletButton（ウォレット UI）
- RecommendationSection, SellerRankingCard（カード表示）
- 購入履歴ページ（テーブル UI）
- ランキングページ（リスト UI）

### Codex レビュー戦略

各サブフェーズ完了後に Codex MCP レビューを実施:

| タイミング | レビュー対象 | 観点 |
|-----------|------------|------|
| Task 1-2 完了後 | 購入履歴 + マルチチェーン | Security: EVM tx 検証、RLS |
| Task 3-4 完了後 | お気に入り + フォロー | Performance: インデックス、N+1 |
| Task 5-7 完了後 | 通知 + レコメンド + ランキング | Quality: 全体整合性 |

---

## 検証方法

1. **ビルド確認**: `npm run build` で型エラー・ビルドエラーがないこと
2. **Supabase マイグレーション**: `supabase db push` で DB 反映
3. **手動テスト**:
   - EVM ウォレット接続（MetaMask テストネット）
   - お気に入りトグル → 一覧反映
   - フォロー → フォロワー数更新 → 通知生成
   - レコメンド表示（同カテゴリアイテム存在時）
   - ランキングページ表示
4. **Codex レビュー**: Security / Performance / Quality の3観点
