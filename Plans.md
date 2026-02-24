# KnowMint - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15 (全タスク完了), 15.6, 16, 20, 21, 22, 23, 27, 28, 29, 30, 31 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。

**Maestro E2E テスト**: 18フロー整備済み・通過確認済み (21/22 ページカバー, 95%) `cc:DONE`
- フロー 01-14: 全通過済み (KnowMint リブランド対応済み)
- フロー 15-18: `/dashboard/rankings`, `/library`, `/list/[id]/edit`, `/category/[slug]` 追加・通過確認済み
- 未カバー: `/library/[id]` のみ (実購入必要のためスキップ継続)

---

## Phase 17-19 (P2 — Phase 15/16 完了後)

詳細: [`plans/phase17-19.md`](plans/phase17-19.md) (Webhook DLQ, メール, モデレーション)

---

## Phase 24: Coinbase AgentKit Action Provider [P1]

> AgentKit エージェントが KnowMint を「ウォレット付きツール」として使えるプラグイン。
> `ActionProvider` クラス + `@CreateAction` デコレーター パターン。

### 24.1 パッケージ骨格

- [ ] `packages/agentkit-plugin/package.json` — `@knowledge-market/agentkit-plugin`, peerDep: `@coinbase/agentkit`
- [ ] `tsconfig.json`: `"experimentalDecorators": true, "emitDecoratorMetadata": true` 必須

### 24.2 KnowledgeMarketActionProvider 実装

- [ ] `ActionProvider` を継承した `KnowledgeMarketActionProvider` クラス
- [ ] `@CreateAction` デコレーターで 5 ツール実装: `km_search`, `km_get_detail`, `km_purchase`, `km_get_content`, `km_publish`
- [ ] `supportsNetwork(_: Network): boolean { return true; }` (chain-agnostic)
- [ ] API 呼び出しは fetch + `X-API-Key` ヘッダー (mcp/src/api.ts と同ロジック)
- [ ] `export const knowledgeMarketActionProvider = (baseUrl, apiKey) => new KnowledgeMarketActionProvider(...)` ファクトリ関数

### 24.3 README + publish

- [ ] 使用例 README (AgentKit.from + actionProviders 設定)
- [ ] `npm publish --access public`

**成果物**: `packages/agentkit-plugin/` — npm `@knowledge-market/agentkit-plugin`

---

## Phase 25: Eliza (ElizaOS) プラグイン [P1]

> ai16z Eliza フレームワーク向けプラグイン。Plugin Registry 登録で公式エコシステム入り。
> `Plugin` インターフェース (`{ name, description, actions }`) + `@elizaos/core` 型使用。

### 25.1 パッケージ骨格

- [ ] `elizaos create plugin-knowledge-market --type plugin` で雛形生成 (推奨)
  または手動で `packages/eliza-plugin/` 作成
- [ ] `package.json`: `@knowledge-market/eliza-plugin`, peerDep: `@elizaos/core ^0.1.7`, devDep: `tsup` (build), `bun test` (test)
- [ ] ビルドツールは **tsup** を使用 (`tsup.config.ts`: `entry: ["src/index.ts"], format: ["esm"], dts: true`)

### 25.2 プラグイン実装 (Actions + Providers)

**Actions** (何を「する」か):
- [ ] `SEARCH_KNOWLEDGE_MARKET`: `similes: ["FIND_KNOWLEDGE","LOOK_UP_KM","SEARCH_KM"]`
  - `validate`: メッセージに検索意図のキーワードが含まれるか
  - `handler`: `/api/v1/knowledge?query=...` を fetch → callback でテキスト返却
- [ ] `PURCHASE_KNOWLEDGE`: `similes: ["BUY_KNOWLEDGE","ACQUIRE_KNOWLEDGE"]`
  - `validate`: 購入意図 + knowledge_id が特定できるか
  - `handler`: devnet 送金 → `/purchase` API → 成功メッセージ
- [ ] `GET_KNOWLEDGE_CONTENT`: `similes: ["READ_KNOWLEDGE","FETCH_CONTENT"]`

**Providers** (コンテキスト情報を供給):
- [ ] `knowledgeMarketProvider`: 毎ターン「最新の人気ナレッジ上位5件」をコンテキストに注入
  - `get()`: `/api/v1/knowledge?sort_by=popular&per_page=5` の結果をテキスト整形して返す

**Plugin オブジェクト**:
- [ ] `export const knowledgeMarketPlugin: Plugin = { name, description, actions, providers, init }`
- [ ] `export default knowledgeMarketPlugin`

### 25.3 README + Registry 登録

- [ ] character.json への追加方法を README に記述 (`plugins: ["@knowledge-market/eliza-plugin"]`)
- [ ] `npm run build && npm publish --access public`
- [ ] ElizaOS Plugin Registry (elizaos-plugins GitHub org) に登録申請 PR

**成果物**: `packages/eliza-plugin/` — npm `@knowledge-market/eliza-plugin` + Registry 登録

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

- **Phase 15.6** (CLI E2E テスト): `scripts/e2e/cli-purchase-flow.mjs` 新規作成 (8ステップ: env検証→購入→km install→ファイル確認)。P2P直接送金・スマコン(`execute_purchase`)両モード PASS。Codex 4ラウンド → ISSUES_FOUND: 0
- **Phase 30** (特商法対応): `/terms` `/privacy` `/legal` `/contact` 4件作成、購入フロー利用規約同意、`seller_disclosure` カラム追加
- **Phase 31** (README 現状反映): 技術スタック・MCP・Cloudflare Workers・全 API・環境変数・テスト手順を現状に同期。Codex 4ラウンド → ISSUES_FOUND: 0

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
