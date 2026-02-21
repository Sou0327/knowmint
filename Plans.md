# Knowledge Market - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

## 戦略方針

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**収益モデル**: スマートコントラクトによるプロトコル手数料の自動分配
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 優先度マトリクス

| 優先度 | 機能 |
|--------|------|
| **P0 (最優先)** | MCP Server — エージェントが発見・購入できるインターフェース |
| **P1 (収益基盤)** | ~~Solana Program デプロイ~~, ~~ナレッジメタデータ強化~~ → 完了 |
| **P2 (整理)** | ~~EVM半端実装の凍結, i18n凍結, コードベーススリム化~~ → 完了 |
| **P3 (拡張)** | 信頼スコア, バージョニング, エージェントSDK |
| **将来** | Request Listing 強化, マルチチェーン本格対応, 運用基盤 |

---

## 完了済みフェーズ (アーカイブ)

- **Phase 1-4** `cc:DONE`: 基盤/出品/Solana決済/エージェントAPI → `plans/archive-phase1-4.md`
- **Phase 5** `cc:DONE`: CLI/MCP サーバー → `plans/archive-phase5-6.md`
- **Phase 6** `cc:DONE`: スマートコントラクト決済 (Codexレビュー5ラウンド完了) → `plans/archive-phase5-6.md`
- **Phase 7** `cc:DONE`: ナレッジメタデータ強化 (Codexレビュー3ラウンド + セキュリティレビュー完了) → 下記
- **Phase 8** `cc:DONE`: コードベース整理 — EVM凍結, i18n凍結, Request Listing UI整理 (Codexレビュー3ラウンド完了) → 下記

### Phase 6 デプロイ完了 (2026-02-20)

- [x] Fee Vault 生成: `GdK2gyBLaoB9PxTLfUesaUn1qsNaKjaux9PzfHKt4ihc`
- [x] `anchor build` 成功 (blake3 1.5.5 ピン留めで platform-tools Cargo 1.84 対応)
- [x] `anchor deploy --provider.cluster devnet` 成功
- [x] devnet テスト合格 (SOL 95/5 分配 + ZeroAmount 拒否)
- [x] `.env.local` に `NEXT_PUBLIC_KM_PROGRAM_ID` / `NEXT_PUBLIC_FEE_VAULT_ADDRESS` 設定済み
- Program ID: `B4Jh6N5ftNZimEu3aWR7JiYu4yhPWN5mpds68E6gWRMb`

### Phase 7 完了 (2026-02-20)

- [x] `metadata JSONB` + `usefulness_score` カラム + `knowledge_feedbacks` テーブル
- [x] RLS: INSERT ポリシーに transaction 整合性 EXISTS 検証
- [x] JSONB 検索用インデックス (式インデックス3本 + GIN)
- [x] `sanitizeMetadata()` で許可リストバリデーション (API route + Server Action 両方)
- [x] 出品/編集フォームにメタデータ折りたたみセクション追加
- [x] API GET/POST に metadata select + JSONB フィルタ4種
- [x] フィードバック API (`POST /api/v1/knowledge/[id]/feedback`) — 購入確認 + 重複防止 + UNIQUE 違反 409 マッピング
- [x] MCP `km_search` に metadata フィルタ (enum) + 品質スコア表示
- [x] Codex レビュー 3ラウンド: Critical 1 → 0, High 3 → 0
- [x] セキュリティレビュー APPROVE

---

## Phase 8: コードベース整理 `cc:DONE` [P2]

### 8.1 EVM 実装の凍結 `cc:DONE`

- [x] `ChainSelector` で Solana 以外を `disabled` + Coming Soon 表示に変更
- [x] `Header.tsx` から `ChainSelector` 削除 (Solana 固定)
- [x] `layout.tsx` から `EVMWalletProvider` 除外 (バンドル軽量化)

### 8.2 i18n 凍結 `cc:DONE`

- [x] `LanguageToggle` / `LocaleAutoTranslator` を UI から非表示に (コード自体は残す)
- [x] `layout.tsx` を `ja` 固定に変更 (cookie 読み取り廃止)

### 8.3 Request Listing の UI 整理 `cc:DONE`

- [x] 出品フォームで `listing_type: 'request'` の選択肢を非表示に (DB・API は残す)
- [x] 検索フィルターから `listing_type` フィルタを削除
- [x] `buildUrl` から `listing_type` パラメータ伝播を除外

> **方針**: Request Listing は将来エージェントが「必要な知識」を依頼するユースケースで復活予定 (Phase 10+)。
> DB スキーマ・API・ロジックは全て残し、UI の入口だけ閉じる。

### Phase 8 Codex レビュー完了 (2026-02-21)

- [x] Codex レビュー 3ラウンド: High 1 → 0, Medium 2 → 0, Low 1 → 0 (設計判断)
- 復活手順: EVMWalletProvider / ChainSelector / LanguageToggle / LocaleAutoTranslator を戻すだけ

---

## Phase 9: 信頼・品質基盤 `cc:DONE` [P3]

- [x] 売り手信頼スコア (`trust_score DECIMAL` in profiles) `cc:DONE`
  - trust_score カラム、recalculate_trust_score PL/pgSQL 関数、5トリガー (feedbacks/follows/reviews/transactions/knowledge_items)
  - SECURITY DEFINER + GRANT EXECUTE + partial index
  - API/UI (SellerCard・SellerRankingCard)/MCP/CLI すべてに反映
- [x] ナレッジバージョニング (`knowledge_item_versions` テーブル) `cc:DONE`
  - advisory lock + atomic RPC `create_version_snapshot`、PATCH API、Versions API
  - VersionHistory UI (useReducer + Server Action)、updateListing にスナップショット統合
  - MCP/CLI/SDK に pagination 対応
- [x] エージェント向け SDK `cc:DONE`
  - TypeScript SDK (`@knowledge-market/sdk`): KnowledgeMarketClient、型定義、examples

### Phase 9 Codex レビュー完了 (2026-02-21)

- Codex レビュー 13ラウンド実施: Critical 0 / High 0 達成
- 主な強化: HTTPS強制、chmod 0700/0600、入力バリデーション全体強化、IPv6対応、NaN防御、fire-and-forget reject handler

---

## 将来フェーズ (未スケジュール)

- マルチチェーン: Base (ETH L2) スマコン決済, Coinbase Agentic Wallets
- Request Listing 復活・強化 (エージェントが依頼を出す仕組み)
- 運用基盤: レート制限共有ストア, 監査ログ, 構造化ログ
- セマンティック検索: pgvector 移行

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Backend/DB | Supabase (PostgreSQL, Auth, Storage, RLS) |
| 決済 | Anchor 0.32.1 (Solana Program) 95/5 自動分配 — devnet デプロイ済み |
| MCP | `@modelcontextprotocol/sdk` (TypeScript) |
| バリデーション | Zod |
| デプロイ | Vercel |
