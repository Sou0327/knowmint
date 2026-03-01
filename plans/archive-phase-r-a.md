# Archive: Phase R + Phase A (完了: 2026-03-01)

---

## Phase R: OSS 公開準備 `cc:完了` (2026-03-01)

> README 英語リライト + LICENSE + devnet ガイド分離 + package.json/CLAUDE.md 修正

### R.1 README.md 英語リライト

- [x] README.md を英語で全面リライト `cc:完了`
  - Hero (バッジ + タグライン + GIF) / Why KnowMint / For AI Agents (MCP + CLI + x402) / For Humans / Quick Start / Agent Plugins / API Overview / Tech Stack / Testing / Deployment / Contributing / License
  - エージェント自己登録フロー (`km_register`, `/api/v1/auth/*`) を追加
- [x] 旧 README の日本語ローカルテストガイドを `docs/local-devnet-guide.md` に移動 `cc:完了`
- [x] README 内の古い記述を修正 (EVM 言及削除、テスト数 202 に更新) `cc:完了`

### R.2 LICENSE ファイル追加

- [x] MIT LICENSE ファイルをルートに作成 `cc:完了`
  - Copyright (c) 2025 KnowMint Contributors

### R.3 リポジトリメタデータ + package.json

- [x] `package.json` に `"description"` + `"license": "MIT"` 追加 `cc:完了`
- [ ] GitHub の Description / Topics / Website URL を設定（手動） `cc:TODO`
  - Description: "Knowledge marketplace where AI agents autonomously buy human expertise"
  - Topics: `ai-agent`, `mcp`, `solana`, `x402`, `marketplace`, `knowledge`
  - Website: knowmint.shop

---

## Phase A: 死コード削除 + テスト統一 `cc:完了` (2026-03-01)

> EVM 死コード全削除 + mocha 廃止 + fire-and-forget エラー可視化

### A.1 EVM 死コード全削除 + USDC UI 削除 `cc:完了`

- [x] `src/contexts/EVMWalletContext.tsx` 削除
- [x] `src/contexts/ChainContext.tsx` 削除
- [x] `src/components/features/EVMWalletButton.tsx` 削除
- [x] `src/components/features/ChainSelector.tsx` 削除
- [x] `src/lib/evm/` ディレクトリ全削除 (config.ts, payment.ts, verify.ts)
- [x] root layout.tsx から EVM/Chain Provider 除去 (5→3 Provider)
- [x] `wagmi`, `@tanstack/react-query` を dependencies から削除
- [x] PurchaseModal から EVM 関連分岐・無効化 UI 削除
- [x] USDC UI 削除 (PurchaseModal / PurchaseSection / KnowledgeCard / RecommendationSection / ListingForm)
- [x] `src/lib/solana/token-accounts.ts` (SPL 関連) 削除
- [x] 設計メモ・CLAUDE.md の EVM / USDC 関連記述更新

### A.2 mocha 全廃 → vitest 統一 `cc:完了`

- [x] `tests/` 内の mocha/chai テストを vitest に書き換え (19ファイル)
- [x] `mocha`, `ts-mocha`, `chai`, `@types/chai`, `@types/mocha` を devDeps から削除
- [x] `vitest.node.config.ts` 新規作成 (node 環境, @/ エイリアス, NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta)
- [x] `package.json` test:unit / test:integration / test:staging スクリプトを vitest に変更
- [x] 187テスト全 PASS 確認

### A.3 fire-and-forget エラー可視化 `cc:完了`

- [x] `src/lib/api/auth.ts` void async IIFE パターンに変換
- [x] `src/lib/knowledge/queries.ts` 同上
- [x] `src/app/api/v1/knowledge/[id]/route.ts` 同上
- [x] `src/app/(main)/knowledge/[id]/actions.ts` 同上
