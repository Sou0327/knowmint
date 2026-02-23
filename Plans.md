# KnowMint - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 20, 21, 22, 15 (15.5・15.3前準備・15.1前準備), 16 (コード実装分), 23, 27, 28 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。

---

## Phase 15 残タスク + Phase 12: mainnet 移行 [P0]

> Phase 15 残り: 要外部操作 (Supabase staging 作成・RLS 統合テスト・devnet 実送金 E2E・Webhook 疎通)
> Phase 12 (15 完了後): `.env.local.example` mainnet 更新 / Helius RPC / `anchor deploy --cluster mainnet-beta` / Vercel 環境変数

---

## Phase 16: 運用信頼性強化 [P1] — 外部操作のみ残

> コード実装はすべて完了済み。Vercel へのデプロイと環境変数設定のみ残る。

### 実装済み (コード確認済み)

- [x] `src/app/api/cron/cleanup-pending-tx/route.ts` — pending TX を 30分後に failed へ更新 (タイミングセーフ認証付き) cc:DONE
- [x] `vercel.json` — cron スケジュール設定済み (`*/30 * * * *`) cc:DONE
- [x] Upstash Redis レート制限 (インメモリフォールバック付き) cc:DONE

### 残り: Vercel 環境変数設定 (外部操作)

- [ ] Vercel に `CRON_SECRET` を設定 → `/api/cron/cleanup-pending-tx` 認証に必須 (本番では未設定だと 401)
- [ ] Vercel に `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` を設定 → 現在インメモリフォールバック動作中
- [ ] Sentry DSN 設定 → Phase 17 スコープ

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

## 設計メモ・要確認事項

> 軽微または将来対応可。タスク化は不要だが記録しておく。

### ④ dataset カラム Migration 確認

`knowledge_item_contents` または `knowledge_items` テーブルに `storage_path`, `checksum_sha256` カラムが存在するか確認が必要。
初期スキーマ (`supabase/migrations/` の最初期ファイル) に含まれているかもしれない。
**対応**: Phase 15 残タスク (staging 統合テスト) 実施時に合わせて確認。問題があれば Migration 追加。

### ⑤ EVM 購入は意図的未対応 (設計上の制限)

`purchase/route.ts` — `chain !== "solana"` は `BAD_REQUEST` を返す。
コメントに `"this phase"` と記載あり。**Solana 優先の設計判断**。
EVM 対応は将来フェーズ (Phase 12 拡張またはマルチチェーン Phase) にて対応予定。

### ⑥ ChainSelector の EVM "Coming Soon" 表示

UI レベルで EVM を無効化。⑤ の API 制限と整合している。
EVM が有効化されるまでこの状態を維持 — **変更不要**。

---

## Phase 29: アプリリネーム — KnowMint → KnowMint [P1]

> ブランド変更: `KnowMint` / `knowledge-market` / `knowledgemarket` / `ナレッジマーケット`
> → `KnowMint` / `knowmint` (表示名・パッケージ名・設定値)
>
> **スコープ外**: Solana プログラム名 (`knowledge_market`) はオンチェーンデプロイ済みのため変更しない。
> **CLIコマンド `km`**: KnowMint の頭文字と一致するためそのまま維持。

### 29.1 UI・メタデータ (src/)

- [ ] `src/app/layout.tsx` — `<title>`, OGP メタタグ, description cc:TODO
- [ ] `src/app/(main)/page.tsx` — トップページのサービス名表示 cc:TODO
- [ ] `src/app/(auth)/login/page.tsx`, `signup/page.tsx` — ページタイトル・表示名 cc:TODO
- [ ] `src/components/layout/Header.tsx`, `Footer.tsx` — ロゴ・サービス名 cc:TODO
- [ ] `src/components/dashboard/ApiKeyManager.tsx` — サービス名文字列 cc:TODO
- [ ] `src/lib/siws/message.ts` — SIWS メッセージ内のサービス名 cc:TODO
- [ ] `src/lib/evm/config.ts`, `src/lib/i18n/jaToEn.ts` — サービス名文字列 cc:TODO

### 29.2 設定ファイル

- [ ] `package.json` (root) — `"name"` フィールド cc:TODO
- [ ] `wrangler.toml` — `name="knowledgemarket"` → `name="knowmint"` cc:TODO
- [ ] `mcp/package.json` — `"name"` + `"description"` cc:TODO
- [ ] `cli/package.json` — `"name"` + `"description"` cc:TODO

### 29.3 MCP・SDK ソース

- [ ] `mcp/src/index.ts`, `mcp/src/api.ts`, `mcp/src/tools.ts` — サービス名文字列 cc:TODO
- [ ] `sdk/src/client.ts`, `sdk/src/types.ts` — サービス名文字列 cc:TODO
- [ ] `sdk/examples/openclaw-integration.ts` — コメント・表示名 cc:TODO

### 29.4 ドキュメント

- [ ] `README.md` — タイトル・説明文 cc:TODO
- [ ] `mcp/README.md`, `cli/README.md` — サービス名 cc:TODO

### 29.5 Plans.md・CLAUDE.md 更新

- [ ] `Plans.md` 冒頭タイトル・説明文を KnowMint に変更 cc:TODO
- [ ] `CLAUDE.md` Project Overview のサービス名を更新 cc:TODO
- [ ] メモリファイル (`MEMORY.md`) のサービス名を更新 cc:TODO

**成果物**: 全 UI・設定・パッケージ名が `KnowMint` / `knowmint` に統一された状態

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
| デプロイ | Vercel |
