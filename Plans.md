# KnowMint - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15 (全タスク完了), 16, 20, 21, 22, 23, 27, 28, 29 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。

**Maestro E2E テスト**: 18フロー整備済み・通過確認済み (21/22 ページカバー, 95%) `cc:DONE`
- フロー 01-14: 全通過済み (KnowMint リブランド対応済み)
- フロー 15-18: `/dashboard/rankings`, `/library`, `/list/[id]/edit`, `/category/[slug]` 追加・通過確認済み
- 未カバー: `/library/[id]` のみ (実購入必要のためスキップ継続)

---

## Phase 15.6: CLI E2E テスト [P1]

> Phase 15 で完了した REST API E2E に続き、`km` CLI の購入フローを検証する。
> mock server テスト (既存) は通過済み。実 Solana 送金を伴う CLI フローが未検証。
>
> **スマートコントラクト**: Phase 6 で devnet デプロイ済み。
> Program ID: `B4Jh6N5ftNZimEu3aWR7JiYu4yhPWN5mpds68E6gWRMb`
> Fee Vault: `GdK2gyBLaoB9PxTLfUesaUn1qsNaKjaux9PzfHKt4ihc`

### 15.6.1 既存テストの実行確認

- [ ] `npm run test:e2e:cli-flow` — mock server で `login → search → install → publish → deploy` が PASS することを確認
- [ ] `npm run test:e2e:fake-tx` — 偽トランザクション拒否が PASS することを確認
- [ ] `npm run test:e2e:x402-flow` — x402 フローが PASS することを確認

### 15.6.2a CLI 実購入フロー — ローカルバリデータ (スマコンなし)

> `NEXT_PUBLIC_KM_PROGRAM_ID=""` で起動。P2P 直接送金 → tx-hash 検証のシンプルな確認。

- [ ] `supabase start` + dev server 起動 (`NEXT_PUBLIC_KM_PROGRAM_ID="" NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899 NEXT_PUBLIC_SOLANA_NETWORK=devnet`)
- [ ] `solana-test-validator --reset --quiet &` で起動、`solana airdrop 10 <buyer> --url http://127.0.0.1:8899`
- [ ] `solana transfer <seller_pubkey> 0.01 --keypair devnet-buyer-keypair.json --url http://127.0.0.1:8899` → tx-hash 取得
- [ ] `km login --api-key <buyer_api_key> --base-url http://localhost:3000`
- [ ] `km install <knowledge_id> --tx-hash <hash> --dir /tmp/km-test` → コンテンツ保存を確認

### 15.6.2b CLI 実購入フロー — 本物 devnet (スマコンあり・5%収益発生)

> `NEXT_PUBLIC_KM_PROGRAM_ID=B4Jh6N5ftNZimEu3aWR7JiYu4yhPWN5mpds68E6gWRMb` で起動。
> API 側がスマートコントラクト経由の送金かどうかを検証 → 通過で Fee Vault に 5% 入金。

- [ ] dev server を本物 devnet env (`NEXT_PUBLIC_SOLANA_NETWORK=devnet`, `NEXT_PUBLIC_SOLANA_RPC_URL=<Helius RPC>`, `NEXT_PUBLIC_KM_PROGRAM_ID=B4Jh6N5ftNZimEu3aWR7JiYu4yhPWN5mpds68E6gWRMb`) で起動
- [ ] Phantom / solana CLI でスマコン経由の送金を行い tx-hash 取得
- [ ] `km install <knowledge_id> --tx-hash <hash> --dir /tmp/km-test` → コンテンツ保存を確認
- [ ] Fee Vault (`GdK2gyBLaoB9PxTLfUesaUn1qsNaKjaux9PzfHKt4ihc`) に 5% 着金を Solana Explorer で確認

### 15.6.3 (任意) CLI 購入フロー スクリプト化

- [ ] `scripts/e2e/cli-purchase-flow.mjs` — 15.6.2a フローを自動化
- [ ] `package.json` に `"test:e2e:cli-purchase": "node scripts/e2e/cli-purchase-flow.mjs"` を追加

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

## Phase 30: 特商法・消費者保護法対応 [P1 — 法的必須]

> マーケットプレイスとして法的に必要な表示義務・消費者保護体制を整備する。
> 暗号資産規制とは独立して、デジタルコンテンツ販売プラットフォームとして確実に対応が必要。
> 詳細調査: [`docs/legal-risk-analysis.md`](docs/legal-risk-analysis.md)

### 30.1 利用規約・プライバシーポリシー整備

- [ ] `src/app/(main)/terms/page.tsx` — 利用規約ページ作成
  - サービス概要、禁止事項、免責事項、準拠法・管轄裁判所
  - デジタルコンテンツの返金ポリシー（原則返金不可 + 例外条件）
  - 暗号資産決済に関する免責（価格変動リスク、送金ミスの自己責任）
  - ノンカストディアルの説明（運営は資産を管理しない旨）
- [ ] `src/app/(main)/privacy/page.tsx` — プライバシーポリシーページ作成
  - 収集データ（ウォレットアドレス、APIキーハッシュ、取引履歴等）
  - Cookie / アナリティクスの使用
  - 第三者提供の有無
- [ ] フッターに利用規約・プライバシーポリシーへのリンク追加

### 30.2 特定商取引法に基づく表示

- [ ] `src/app/(main)/legal/page.tsx` — 特商法に基づく表示ページ
  - 運営者情報（名称、所在地、連絡先）
  - 販売価格の表示方法（暗号資産建て）
  - 引渡時期（即時ダウンロード）
  - 返品・返金について
- [ ] 出品者への表示義務ガイドライン
  - 出品フォームに販売者情報の入力欄追加（または省略条件の明示）
  - `knowledge_items` テーブルに `seller_disclosure` カラム追加を検討

### 30.3 取引DPF消費者保護法対応

- [ ] 苦情処理体制の整備
  - お問い合わせフォーム or メールアドレスの設置
  - `src/app/(main)/contact/page.tsx` — お問い合わせページ
- [ ] 出品者の身元確認努力義務への対応
  - 出品時にウォレット署名認証（SIWS）を必須化（Phase 21 で実装済み）
  - 出品者プロフィールに最低限の情報表示
- [ ] 販売者情報の開示請求対応フローの策定
  - 消費者からの開示請求があった場合の運営手順をドキュメント化

### 30.4 フッター・ナビゲーション更新

- [ ] フッターコンポーネントにリーガルリンク群を追加
  - 利用規約 / プライバシーポリシー / 特商法表示 / お問い合わせ
- [ ] 購入フロー内に利用規約同意チェックボックス追加

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
