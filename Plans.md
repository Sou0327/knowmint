# KnowMint - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。Maestro E2E: 18フロー (21/22 ページ, 95%)

---

## Phase 26: 自律購入デモ動画 [P1 — 訴求コンテンツ]

> 「AIエージェントが知識を自律購入した」実証動画。これが最強のマーケティング素材。

### 26.1 デモシナリオ設計

- [ ] デモ用ナレッジアイテムを出品 (例: `"Solana DeFi arbitrage — 6-month real P&L data"`, 0.01 SOL, type: dataset)
- [ ] `scripts/demo/autonomous-purchase-demo.mjs` 作成
  - km_search → km_get_detail → devnet 送金 → km_purchase → km_get_content の 5 ステップ自動実行

### 26.2 Claude Code + MCP でデモ実行

- [ ] ローカル起動 + MCP 設定 → Claude に「Find and purchase the best Solana DeFi knowledge」
- [ ] Claude が自律的に search → detail → purchase → content を実行するフローをキャプチャ

### 26.3 録画・公開

- [ ] `asciinema rec` でターミナル録画 → GIF 変換 (`agg`)
- [ ] README.md トップに GIF 埋め込み
- [ ] Twitter/X + Warpcast (Farcaster) に投稿

### 26.4 LP 更新

- [ ] Web UI トップページに「How it works for AI Agents」セクション (デモ GIF + 3 ステップ)
- [ ] `npx @knowledge-market/mcp-server` 設定例をトップページに掲載

**成果物**: `scripts/demo/autonomous-purchase-demo.mjs`, デモ GIF, README 更新, SNS 投稿

---

## 設計メモ

- **④ dataset Migration**: `storage_path`, `checksum_sha256` カラム → Phase 15 staging テスト時に確認
- **⑤⑥ EVM**: 意図的未対応 (Solana 優先)。`chain !== "solana"` → BAD_REQUEST、ChainSelector も Coming Soon。将来フェーズで対応。
- **Phase 29** (KnowMint リブランド): cc:DONE。詳細: `plans/archive-phase16-29.md`

---

## Phase 32.3 (後回し) スマコン mainnet デプロイ `cc:DEFERRED`

> Phase 26 デモ・拡散の反響を見てから着手。P2P モードで十分運用可能。

- [ ] `anchor deploy --provider.cluster mainnet` → Program ID / Fee Vault 設定

---

## Phase 33: 品質担保機能 [P1]

> 会話ログ (2026-02-25) の方針決定:
> - **無料tier**: 証拠フィールド必須化 + ティア型プレビュー → 品質の最低ライン担保
> - **有料tier (将来)**: AI非代替認定バッジ → 別フェーズで収益化機能として実装

### 33.1 出品フォーム: 構造化「証拠」フィールド必須化

> 自由記述ではなく「検証済みの結果」として見せる。

- [ ] `knowledge_items` テーブルに `evidence_description` (text) / `evidence_url` (text, optional) カラム追加
  - migration: `20260225000029_phase33_evidence_fields.sql`
- [ ] 出品フォーム (`/list`) に必須フィールドを追加
  - 「この知識で得た具体的な結果 (数字・実績)」← 必須
  - 「使った状況・時期」← 必須
  - 「証拠リンク (Solana Explorer / GitHub / 記事等)」← 任意
- [ ] 知識詳細ページ (`/knowledge/[id]`) に証拠セクションを表示
- [ ] API バリデーション (Zod) に `evidence_description` 必須追加

### 33.2 ティア型プレビュー

> Layer 2 の質が Layer 3 の品質を予測させる。

- [ ] `knowledge_items` テーブルに `key_insight` (text) カラム追加 ← Layer 2 用
  - migration: 同上
- [ ] 出品フォームに「核心のさわり (1つだけ公開)」フィールドを追加
- [ ] 知識詳細ページのプレビューを 3 層構造に変更
  ```
  Layer 1 (無料): 「何が解決できるか」= 既存 description
  Layer 2 (無料): 核心のさわり 1 つ = key_insight
  Layer 3 (有料): フルコンテンツ = 既存 content
  ```
- [ ] MCP `km_get_detail` レスポンスに `key_insight` を含める

### 33.3 (将来・有料) AI非代替認定バッジ

> Claude が「学習データから答えられない」と判定した知識にバッジ付与。
> 出品者が 1 件ごと or 月額で課金する収益化機能。

- [ ] 設計・料金体系の決定 (別途検討)
- [ ] 出品 API に Claude 審査フローを追加
- [ ] 認定バッジの UI デザイン
- [ ] 認定済み知識を検索上位表示

**成果物**: 証拠フィールド・ティア型プレビューを備えた品質担保出品フロー

---

## Phase 34: SEO / OGP 基盤 `cc:DONE`

> 全公開ページの OGP・メタタグ・sitemap・robots・JSON-LD を整備。Codex 3ラウンド → ISSUES_FOUND: 0

- [x] 34.1 `layout.tsx` に `metadataBase` + OGP + Twitter Card + `og-default.png` (1200x630 DQ テーマ)
- [x] 34.2 `getKnowledgeForMetadata()` (Admin client, view_count 汚染なし) + `/knowledge/[id]` に `generateMetadata()` + canonical
- [x] 34.3 `sitemap.ts` (静的6ページ + published 動的、50,000 URL 上限準拠) + `robots.ts` (dashboard/profile/api/list/library disallow)
- [x] 34.4 `JsonLd` コンポーネント (`<` → `\u003c` XSS 対策) + Product JSON-LD (`/knowledge/[id]`) + WebSite+SearchAction (`/`)
- [x] 34.5 rankings/category/search/dashboard/terms/privacy/legal/contact の metadata 補完 (noindex, openGraph, canonical)
- [x] 34.6 (将来) 動的 OG 画像 — CF Workers 3MiB 制限のため据え置き

**成果物**: 全公開ページの OGP・メタタグ・sitemap・robots・JSON-LD

---

## 将来フェーズ (未スケジュール)

- Request Listing 復活・強化, pgvector セマンティック検索, LangChain/AutoGen/CrewAI プラグイン対応

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Backend/DB | Supabase (PostgreSQL, Auth, Storage, RLS) |
| 決済 | Anchor 0.32.1 (Solana Program) 95/5 自動分配 — devnet デプロイ済み |
| MCP | `@modelcontextprotocol/sdk` (TypeScript) |
| デプロイ | Cloudflare Workers (opennextjs-cloudflare) |
