# KnowMint - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R, 45 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。Maestro E2E: 18フロー (21/22 ページ, 95%)

---

## Phase R: OSS 公開準備 [P0 — 今すぐ] 🚨

> リポジトリは既に Public。日本語 README のまま公開中。即対応。

### R.1 README.md 英語リライト

- [ ] README.md を英語で全面リライト `cc:TODO`
  - Hero: タグライン + (GIF placeholder)
  - Why KnowMint: 3行で価値提案
  - For AI Agents: MCP / CLI / x402 の使い方
  - For Humans: Web UI の概要
  - Quick Start: clone → env → supabase start → npm run dev
  - Agent Plugins: AgentKit + ElizaOS（コード例付き）
  - API Overview: 主要エンドポイントのみ（詳細は docs/ 参照）
  - Tech Stack: テーブル
  - Contributing: 簡潔に
  - License: MIT
- [ ] 旧 README の日本語ローカルテストガイドを `docs/local-devnet-guide.md` に移動 `cc:TODO`
- [ ] README 内の古い記述を修正 (EVM 言及削除、Mocha → Vitest、テスト数更新) `cc:TODO`

### R.2 LICENSE ファイル追加

- [ ] MIT LICENSE ファイルをルートに作成 `cc:TODO`

### R.3 リポジトリメタデータ

- [ ] GitHub の Description / Topics / Website URL を設定（手動） `cc:TODO`
  - Description: "Knowledge marketplace where AI agents autonomously buy human expertise"
  - Topics: `ai-agent`, `mcp`, `solana`, `x402`, `marketplace`, `knowledge`
  - Website: knowmint.shop (あれば)

---

## Phase A: 死コード削除 + テスト統一 [P0 — 技術的負債]

> 「やらないことを決める」フェーズ。EVM 死コード全削除 + mocha 廃止で即効のコードベース軽量化。

### A.1 EVM 死コード全削除

- [ ] `src/contexts/EVMWalletContext.tsx` 削除 `cc:TODO`
- [ ] `src/contexts/ChainContext.tsx` 削除 `cc:TODO`
- [ ] `src/components/features/EVMWalletButton.tsx` 削除 `cc:TODO`
- [ ] `src/components/features/ChainSelector.tsx` 削除 `cc:TODO`
- [ ] `src/lib/evm/` ディレクトリ全削除 (config.ts, payment.ts, verify.ts) `cc:TODO`
- [ ] root layout.tsx から EVM/Chain Provider 除去 (5→3 Provider) `cc:TODO`
- [ ] `wagmi`, `viem`, `@tanstack/react-query` を dependencies から削除 `cc:TODO`
- [ ] PurchaseModal から EVM 関連分岐・無効化 UI 削除 `cc:TODO`
- [ ] 設計メモ・CLAUDE.md の EVM 関連記述更新 `cc:TODO`

### A.2 mocha 全廃 → vitest 統一

- [ ] `tests/` 内の mocha/chai テストを vitest に書き換え `cc:TODO`
- [ ] `mocha`, `ts-mocha`, `chai`, `@types/chai`, `@types/mocha` を devDeps から削除 `cc:TODO`
- [ ] `.mocharc.*` 設定ファイル削除 `cc:TODO`

### A.3 fire-and-forget エラー可視化

- [ ] audit log / email / webhook dispatch の `.then(() => {}, () => {})` に `console.error` 追加 `cc:TODO`

---

## Phase B: Provider 最適化 + Playwright E2E [P1 — パフォーマンス・品質]

> バンドルサイズ削減 + E2E テスト基盤の近代化。

### B.1 WalletProvider lazy 化

- [ ] root layout.tsx から SolanaWalletProvider を除去 `cc:TODO`
- [ ] 購入ページ (`/knowledge/[id]`) と出品ページ (`/list`) にのみ WalletProvider を配置 `cc:TODO`
- [ ] WalletButton を wallet 不要ページでは非表示 or ConnectWallet CTA に変更 `cc:TODO`

### B.2 Playwright E2E 導入

- [ ] Playwright セットアップ (`playwright.config.ts`, `tests/e2e/`) `cc:TODO`
- [ ] Maestro 18 フローのうち主要 10 フローを Playwright に移植 `cc:TODO`
- [ ] CI に Playwright を組み込み `cc:TODO`
- [ ] Maestro フロー・設定を `_archived/` に移動 `cc:TODO`

---

## Phase C: i18n URL 化 + shadcn/ui 段階導入 [P1 — SEO・保守性]

> SEO の根本改善 + 自前 UI コンポーネント保守からの解放。

### C.1 i18n URL ベース化

- [ ] next-intl middleware を URL ベース (`/ja/`, `/en/`) に変更 `cc:TODO`
- [ ] `hreflang` タグ出力 `cc:TODO`
- [ ] 既存 cookie ベースからのリダイレクト (後方互換) `cc:TODO`
- [ ] sitemap.xml に言語別 URL 追加 `cc:TODO`

### C.2 shadcn/ui 段階導入

- [ ] shadcn/ui セットアップ (`components.json`, Tailwind 統合) `cc:TODO`
- [ ] Button → shadcn/ui Button に置換 (DQ テーマ維持) `cc:TODO`
- [ ] Modal → shadcn/ui Dialog に置換 (focus trap 自動解決) `cc:TODO`
- [ ] Input / Textarea / Select → shadcn/ui に置換 `cc:TODO`
- [ ] Card → shadcn/ui Card に置換 `cc:TODO`
- [ ] 自前 `src/components/ui/` の旧コンポーネント削除 `cc:TODO`

### C.3 ダークモード手動切り替え

- [ ] Tailwind を `class` strategy に変更 `cc:TODO`
- [ ] テーマトグルコンポーネント追加 (Header) `cc:TODO`
- [ ] `localStorage` でテーマ永続化 `cc:TODO`

---

## Phase 26: 自律購入デモ動画 [P1 — 訴求コンテンツ]

> 「AIエージェントが知識を自律購入した」実証動画。最強のマーケティング素材。
> 前提: Phase 40 (自律オンボーディング) 完了済。着手可能。

- [ ] 26.1 デモシナリオ設計 + `scripts/demo/autonomous-purchase-demo.mjs` 作成
- [ ] 26.2 Claude Code + MCP でデモ実行・キャプチャ
- [ ] 26.3 `asciinema rec` → GIF → README + SNS 投稿
- [ ] 26.4 Web UI トップに「How it works for AI Agents」セクション

---

## Phase 33: 品質担保機能 [P1]

> 無料tier: 証拠フィールド必須化 + ティア型プレビュー。

### 33.1 構造化「証拠」フィールド必須化

- [ ] `evidence_description` / `evidence_url` カラム追加 (migration)
- [ ] 出品フォーム + 詳細ページ + API バリデーション

### 33.2 ティア型プレビュー

- [ ] `key_insight` カラム追加 → 3層構造 (description → key_insight → content)
- [ ] MCP `km_get_detail` に `key_insight` 追加

### 33.3 AI非代替認定バッジ `cc:DEFERRED`

---

## Phase 35: ブランド画像アセット整備 [P1]

- [ ] 35.1 favicon (32/192/512/apple-icon) + テンプレート残骸 SVG 削除
- [ ] 35.2 OG デフォルト画像リデザイン (1200x630, DQ テーマ)
- [ ] 35.3 動的 OG 画像 `cc:DEFERRED` (CF Workers 3MiB 制限)

---

## Phase 47: CI 型安全パイプライン [P1 — 堅牢性]

> Database 型が手書き。マイグレーション追加時に型ファイルとの乖離が無チェックで発生する。

- [ ] 47.1 `supabase gen types typescript` → `src/types/database.types.ts` 自動生成スクリプト作成 `cc:TODO`
- [ ] 47.2 CI で `supabase gen types` → `git diff --exit-code` チェック追加 (型乖離検出) `cc:TODO`
- [ ] 47.3 `npm run build` を CI に組み込み (型エラー = ビルド失敗) `cc:TODO`

---

## Phase 50: updateListing RPC 原子化 [P2 — データ整合性]

- [ ] 50.2 `updateListing` を RPC トランザクション化 (version snapshot + update の原子性) `cc:TODO`

---

## Phase 32.3: スマコン mainnet デプロイ `cc:DEFERRED`

> Phase 26 デモ・拡散の反響を見てから着手。P2P モードで十分運用可能。

- [ ] `anchor deploy --provider.cluster mainnet` → Program ID / Fee Vault 設定

---

## 削除済みフェーズ (理由付き)

| Phase | 削除理由 |
|-------|----------|
| 48 (Rate Limit 障害耐性) | Upstash fallback 修正より CF 組み込み rate limiting が正解。問題設定が間違い |
| 49 (E2E Maestro 拡大) | Phase B で Maestro → Playwright に置換するため、Maestro フロー追加は無駄 |
| 50.1 (Modal focus trap) | Phase C で shadcn/ui Dialog に置換すれば built-in で解決 |
| 51 (git history cleanup) | devnet keypair は低リスク。force push のリスクのほうが高い |

---

## 将来フェーズ (未スケジュール)

- Request Listing 復活・強化, pgvector セマンティック検索, LangChain/AutoGen/CrewAI プラグイン対応

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Backend/DB | Supabase (PostgreSQL, Auth, Storage, RLS) |
| 決済 | Solana のみ (EVM 対応は Phase A で死コード削除) |
| MCP | `@modelcontextprotocol/sdk` (TypeScript) |
| デプロイ | Cloudflare Workers (opennextjs-cloudflare) |
