# KnowMint - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15 (全タスク完了), 15.6, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。

**Maestro E2E テスト**: 18フロー整備済み・通過確認済み (21/22 ページカバー, 95%) `cc:DONE`
- フロー 01-14: 全通過済み (KnowMint リブランド対応済み)
- フロー 15-18: `/dashboard/rankings`, `/library`, `/list/[id]/edit`, `/category/[slug]` 追加・通過確認済み
- 未カバー: `/library/[id]` のみ (実購入必要のためスキップ継続)

---

## Phase 24: Coinbase AgentKit Action Provider `cc:DONE`

> AgentKit エージェントが KnowMint を「ウォレット付きツール」として使えるプラグイン。

- [x] `packages/agentkit-plugin/` — `ActionProvider<WalletProvider>` + `@CreateAction` で 5 アクション実装
- [x] Codex 11 ラウンドレビュー → ISSUES_FOUND: 0
- [x] モックテスト 50/50 PASS + ローカル実通信テスト 7/7 PASS
- [x] `npm publish` → `@knowmint/agentkit-plugin@0.1.0` 公開済み

**成果物**: `packages/agentkit-plugin/` ([npm](https://www.npmjs.com/package/@knowmint/agentkit-plugin))

---

## Phase 25: Eliza (ElizaOS) プラグイン `cc:DONE`

> ai16z Eliza フレームワーク向けプラグイン。Plugin Registry 登録で公式エコシステム入り。

- [x] `packages/eliza-plugin/` — Actions (SEARCH/PURCHASE/GET_CONTENT) + Provider (人気5件注入)
- [x] Codex 5 ラウンドレビュー → ISSUES_FOUND: 0
- [x] ユニットテスト 53/53 PASS + ライブ API 統合テスト 8/8 PASS (計 61/61)
- [x] `npm publish` → `@knowmint/eliza-plugin@0.1.0` 公開済み
- [x] ElizaOS Plugin Registry 登録申請 → [PR #273](https://github.com/elizaos-plugins/registry/pull/273)

**成果物**: `packages/eliza-plugin/` ([npm](https://www.npmjs.com/package/@knowmint/eliza-plugin))

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

## Phase 32: mainnet 移行 (P2P モード) [P1]

> 会話ログ (2026-02-24) の方針決定:
> - **Step 1**: P2P モード (`NEXT_PUBLIC_KM_PROGRAM_ID=""`) で mainnet 移行 → コスト ¥0
> - **Step 2**: デモ動画 (Phase 26) を mainnet P2P で撮影・拡散
> - **Step 3**: 反響確認後にスマコン mainnet デプロイ (~1.5 SOL / ¥18,000 相当、一回限り)

### 32.1 環境変数変更 (P2P mainnet)

- [ ] 本番環境変数を更新
  - `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
  - `NEXT_PUBLIC_SOLANA_RPC_URL=<Helius mainnet RPC URL>` (無料枠で十分)
  - `NEXT_PUBLIC_KM_PROGRAM_ID=""` (P2P 直接送金モード)
  - `X402_NETWORK=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d` (mainnet CAIP-2)
- [ ] Cloudflare Workers の環境変数 (wrangler secrets) に反映
- [ ] `npm run deploy:cf` でデプロイ確認

### 32.2 動作確認

- [ ] ウォレット接続 → mainnet SOL 残高表示を確認
- [ ] 0.001 SOL の P2P テスト送金 → tx-hash を purchase API に送信 → 成功を確認
- [ ] MCP `km_purchase` を devnet → mainnet に切り替えて動作確認

### 32.3 (後回し可) スマコン mainnet デプロイ

> Phase 26 デモ・拡散の反響を見てから着手する。
> コスト: ~1.5 SOL ($120 / ¥18,000 相当、一回限り・維持費ゼロ)

- [ ] `anchor build` → `target/deploy/knowledge_market.so` (212KB) を確認
- [ ] `anchor deploy --provider.cluster mainnet` で mainnet にデプロイ
- [ ] 新 Program ID / Fee Vault を環境変数に設定
- [ ] 5% フィー着金をテストトランザクションで確認

**成果物**: mainnet P2P モードで動作する KnowMint 本番環境

---

## 完了済みフェーズ詳細 `cc:DONE`

- **Phase 15.6** (CLI E2E テスト): P2P・スマコン両モード PASS。Codex 4ラウンド → ISSUES_FOUND: 0
- **Phase 17** (Webhook DLQ + メール通知): `webhook_delivery_logs` テーブル、Resend REST fetch メール送信、購入完了/APIキー作成削除メール。Codex 3ラウンド → ISSUES_FOUND: 0
- **Phase 18** (MCP Server 本番公開): `/api/health` ヘルスチェック、Claude Desktop 設定例追記
- **Phase 19** (コンテンツモデレーション): `knowledge_item_reports` + `admin_review_report` RPC、報告/管理者API。Codex 3ラウンド → ISSUES_FOUND: 0
- **Phase 30** (特商法対応): `/terms` `/privacy` `/legal` `/contact` 4件、利用規約同意、`seller_disclosure`
- **Phase 31** (README 現状反映): Codex 4ラウンド → ISSUES_FOUND: 0
- **Phase 24** (AgentKit プラグイン): `ActionProvider` + 5 `@CreateAction`。Codex 11ラウンド → ISSUES_FOUND: 0。テスト 57/57 PASS (モック 50 + ローカル実通信 7)
- **Phase 25** (ElizaOS プラグイン): Actions 3 + Provider 1。Codex 5ラウンド → ISSUES_FOUND: 0

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
