# Knowledge Market - 全タスク実装計画

## Context

Knowledge Market は AIエージェントと人間が知識を売買するマーケットプレイス。現在はスケルトン状態（Next.js 16 + Supabase クライアントのみ）。Plans.md の全20タスク（Phase 1〜5）を実装する。

**現状**: src/app/layout.tsx, page.tsx（デフォルトテンプレ）, lib/supabase/{client,server}.ts のみ。コンポーネント・Auth・DB・API・Solana 全て未実装。

---

## 実装順序（8 Wave）

### Wave 1: 型定義 + パッケージ（並列3トラック）

**Track A**: Solana パッケージインストール
```bash
npm install @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets @solana/wallet-adapter-base
```

**Track B**: 型定義ファイル作成
- `src/types/database.types.ts` - ContentType, KnowledgeStatus, TransactionStatus, Chain, Token enum
- `src/types/knowledge.types.ts` - KnowledgeFormData, KnowledgeItem 等
- `src/types/wallet.types.ts` - WalletContextType

**Track C**: Solana ユーティリティ基盤
- `src/lib/solana/connection.ts` - RPC Connection 設定

**対応タスク**: Plans.md 1.1（Solana パッケージ）

---

### Wave 2: DB スキーマ（直列）

**ファイル**: `supabase/migrations/20260216000001_initial_schema.sql`

テーブル:
1. `profiles` - auth.users 拡張（display_name, avatar_url, wallet_address, bio）
2. `categories` - カテゴリ（name, slug, parent_id, icon）
3. `knowledge_items` - 知識アイテム（seller_id, title, description, content_type, price_sol, price_usdc, preview_content, full_content, file_url, category_id, tags[], status, search_vector）
4. `transactions` - 取引記録（buyer_id, seller_id, knowledge_item_id, amount, token, chain, tx_hash, status）
5. `reviews` - レビュー（transaction_id, reviewer_id, knowledge_item_id, rating, comment）
6. `api_keys` - APIキー（user_id, key_hash, name, permissions[], last_used_at）

追加:
- パフォーマンスインデックス（seller, status, category, buyer, knowledge）
- 全文検索（tsvector + GIN index + trigger）
- RLS ポリシー（全テーブル）

**シードデータ**: `supabase/migrations/20260216000002_seed_categories.sql`
- プロンプト, ツール定義, データセット, API, 汎用ナレッジ

**手動型生成**: `src/types/supabase.types.ts`（Supabase スキーマから手動定義）

**対応タスク**: Plans.md 1.3

---

### Wave 3: UI コンポーネント + レイアウト（並列2トラック）

**Track A**: 基本UI部品
- `src/components/ui/Button.tsx` - variant (primary/secondary/outline/ghost/danger), size, loading
- `src/components/ui/Input.tsx` - label, error, hint 対応
- `src/components/ui/Card.tsx` - padding, hover 対応
- `src/components/ui/Badge.tsx` - variant (default/success/warning/error/info)
- `src/components/ui/Spinner.tsx` - size (sm/md/lg)
- `src/components/ui/Select.tsx` - ドロップダウン
- `src/components/ui/Textarea.tsx` - テキストエリア
- `src/components/ui/Modal.tsx` - モーダルダイアログ

**Track B**: レイアウトコンポーネント
- `src/components/layout/Header.tsx` - ナビゲーション、検索、ウォレット接続、ユーザーメニュー（'use client'）
- `src/components/layout/Footer.tsx` - リンク、コピーライト（Server Component）
- `src/components/layout/Sidebar.tsx` - カテゴリナビゲーション

**統合**: `src/app/layout.tsx` 更新（Header/Footer 組み込み）

**対応タスク**: Plans.md 1.1（共通UIレイアウト）

---

### Wave 4: 認証システム（直列）

1. **Auth Context**: `src/contexts/AuthContext.tsx` - セッション管理、useAuth フック
2. **セッションヘルパー**: `src/lib/auth/session.ts` - getSession(), requireAuth()
3. **Middleware**: `src/middleware.ts` - ルート保護（/list, /library, /dashboard, /profile を保護）
4. **Auth レイアウト**: `src/app/(auth)/layout.tsx` - 認証ページ用レイアウト
5. **ログイン**: `src/app/(auth)/login/page.tsx` - メール+パスワード
6. **サインアップ**: `src/app/(auth)/signup/page.tsx` - 登録+プロフィール作成
7. **プロフィール**: `src/app/(main)/profile/page.tsx` - 編集フォーム

**注意**: ウォレット認証は Wave 8 で統合。MVP はメール認証のみ。

**対応タスク**: Plans.md 1.2

---

### Wave 5: 出品機能（直列）

1. **出品ページ**: `src/app/(main)/list/page.tsx` - マルチステップフォーム
2. **ステップコンポーネント**:
   - `src/components/features/ListingForm/BasicInfoStep.tsx` - タイトル、説明、カテゴリ、タグ
   - `src/components/features/ListingForm/ContentEditor.tsx` - content_type に応じたエディタ切替
   - `src/components/features/ListingForm/PricingStep.tsx` - SOL/USDC 価格入力
   - `src/components/features/ListingForm/PreviewStep.tsx` - プレビュー設定+公開確認
3. **Server Actions**: `src/app/(main)/list/actions.ts` - CRUD + publish
4. **出品管理**: `src/app/(main)/dashboard/listings/page.tsx` - 一覧、編集、削除

**対応タスク**: Plans.md 2.1

---

### Wave 6: 一覧・検索（並列4トラック）

**Track A**: トップページ
- `src/app/(main)/page.tsx` 書き換え - 注目・新着・人気セクション

**Track B**: カテゴリページ
- `src/app/(main)/category/[slug]/page.tsx` - カテゴリ別一覧

**Track C**: 検索ページ
- `src/app/(main)/search/page.tsx` - 全文検索、フィルタ、ソート
- `src/components/features/SearchBar.tsx` - ヘッダー検索バー

**Track D**: 共通コンポーネント
- `src/components/features/KnowledgeCard.tsx` - 知識カード
- `src/lib/knowledge/queries.ts` - 共通クエリ関数

**対応タスク**: Plans.md 2.2

---

### Wave 7: 知識詳細ページ（直列）

1. **詳細ページ**: `src/app/(main)/knowledge/[id]/page.tsx` - 説明、プレビュー、出品者、レビュー、関連
2. **プレビューコンポーネント**: `src/components/features/ContentPreview.tsx` - content_type 別表示
3. **出品者カード**: `src/components/features/SellerCard.tsx`
4. **レビュー一覧**: `src/components/features/ReviewList.tsx`
5. **価格表示**: SOL/USDC + 購入ボタン（Wave 8 で接続）

**対応タスク**: Plans.md 2.3

---

### Wave 8: Solana 決済 + 購入フロー（直列）

1. **Wallet Context**: `src/contexts/WalletContext.tsx` - Solana Wallet Adapter Provider
2. **レイアウト更新**: `src/app/layout.tsx` に WalletProvider 追加
3. **ウォレットUI**: `src/components/features/WalletButton.tsx` - 接続/切断/アドレス表示
4. **決済ユーティリティ**:
   - `src/lib/solana/payment.ts` - SOL/USDC トランザクション構築
   - `src/lib/solana/confirm.ts` - オンチェーン確認
5. **購入モーダル**: `src/components/features/PurchaseModal.tsx` - トークン選択、確認、実行
6. **購入 Server Action**: `src/app/(main)/knowledge/[id]/actions.ts` - tx検証 + DB記録 + アクセス権付与
7. **マイライブラリ**: `src/app/(main)/library/page.tsx` - 購入済み一覧
8. **コンテンツ閲覧**: `src/app/(main)/library/[id]/page.tsx` - 全文表示/DL
9. **レビュー投稿**: `src/components/features/ReviewForm.tsx`
10. **アクセス制御**: `src/lib/knowledge/access.ts` - 購入確認ユーティリティ

**対応タスク**: Plans.md 3.1, 3.2, 3.3

---

### Wave 9〜13: Post-MVP（Phase 4-5）

| Wave | 内容 | 対応タスク |
|------|------|-----------|
| 9 | API基盤（キー管理、認証MW、レート制限） | 4.1 |
| 10 | APIエンドポイント（REST CRUD、購入API） | 4.2, 4.3 |
| 11 | ダッシュボード（売上、履歴、プロフィール、APIキー管理） | 5.1 |
| 12 | マルチチェーン（Base/Ethereum、EVM tx、チェーン切替） | 5.2 |
| 13 | 追加機能（お気に入り、フォロー、通知、レコメンド、ランキング） | 5.3 |

---

## 依存グラフ

```
Wave 1 (型+パッケージ) ─→ Wave 2 (DB) ─→ Wave 3 (UI) ─→ Wave 4 (Auth)
                                                              ↓
                              Wave 5 (出品) ← Wave 6 (一覧) ← Wave 7 (詳細)
                                                              ↓
                                                        Wave 8 (決済) = MVP完了
                                                              ↓
                                                        Wave 9-13 (Post-MVP)
```

**注**: Wave 3 と Wave 2 は並列可能。Wave 5 と Wave 6 も部分的に並列可能。

---

## 並列実行戦略

| Wave | 並列ワーカー数 | 理由 |
|------|--------------|------|
| 1 | 3 | 完全独立（パッケージ/型/Solana lib） |
| 2 | 1 | SQL マイグレーションは直列必須 |
| 3 | 3 | UI/レイアウト/統合で分離可能 |
| 4 | 1 | Auth は依存チェーンが深い |
| 5 | 1 | フォームステップ間に依存 |
| 6 | 3 | ページ間が独立（トップ/カテゴリ/検索） |
| 7 | 1 | 詳細ページに全て統合 |
| 8 | 1 | 決済は直列必須（セキュリティ） |

---

## 検証方法

各 Wave 完了後:
1. `npm run build` - ビルド成功確認
2. `npm run lint` - ESLint 通過確認
3. `npm run dev` でブラウザ確認
4. Wave 8 完了後: 全フロー E2E テスト（出品→検索→詳細→購入→閲覧）

---

## 重要な既存ファイル（再利用）

| ファイル | 用途 |
|---------|------|
| `src/lib/supabase/client.ts` | ブラウザ側 Supabase クライアント |
| `src/lib/supabase/server.ts` | サーバー側 Supabase クライアント |
| `src/app/layout.tsx` | ルートレイアウト（Wave 3, 8 で更新） |
| `src/app/globals.css` | テーマ変数（Wave 3 で拡張） |
