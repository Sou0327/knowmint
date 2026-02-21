# Phase 1-4 アーカイブ (全完了)

## Phase 1: 基盤構築 `cc:DONE`

- Next.js 16 + TypeScript + Tailwind CSS v4 セットアップ
- Supabase SDK, クライアント設定
- 基本UIコンポーネント (Button, Input, Card, Badge, Spinner, Select, Textarea, Modal)
- 共通UIレイアウト (Header, Footer, Sidebar)
- Solana 関連パッケージ
- Supabase Auth (メール認証), サインアップ/ログインページ, middleware.ts
- ユーザープロフィール拡張
- DB スキーマ: profiles, categories, knowledge_items, knowledge_item_contents, transactions, reviews, api_keys
- RLS ポリシー, セキュリティ強化マイグレーション

## Phase 2: 出品・一覧 MVP `cc:DONE`

- 出品フォーム (5種コンテンツタイプ対応)
- 価格設定, プレビュー, 下書き/公開フロー
- トップページ (注目・新着・人気)
- カテゴリ別一覧, キーワード検索, フィルタ, ソート
- 知識詳細ページ, レビュー一覧

## Phase 3: Solana 決済 `cc:DONE`

- Wallet Adapter (Phantom, Solflare, Backpack)
- SOL 送金トランザクション構築・署名・送信
- オンチェーン確認・検証
- DB 取引記録, コンテンツアクセス権付与
- 購入済み一覧 (マイライブラリ), レビュー投稿

## Phase 4: エージェントAPI `cc:DONE`

- API認証 (Bearer token), レート制限, レスポンスヘルパー
- CRUD エンドポイント: knowledge (一覧/詳細/出品/プレビュー/購入/コンテンツ取得)
- カテゴリ, APIキー管理
- バッチ取得, Webhook 通知
- エージェント最適化 (?format=raw, JSON直接取得)

## セキュリティ強化 (Codex レビュー) `cc:DONE`

### Critical
- B1: 購入額の未検証 → DB価格使用
- B2: エラーメッセージ漏洩 → console.error のみ

### High
- A1: getAdminClient() 共有化
- A2: withApiAuth() ミドルウェア集約
- B3: Webhook SSRF 防止
- B4: パーミッション実施
- B5: 認証前IPレート制限
- C1: last_used_at スロットリング
- C2: count "estimated"
- C3: reviews .limit(20)
- D1: fire-and-forget reject handler
- D2: セキュリティヘッダー
- ボイラープレート除去, import 重複削除
