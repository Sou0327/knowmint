# KnowMint - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R, 45, R, A すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。Maestro E2E: 18フロー (21/22 ページ, 95%)
Phase R (OSS公開): `plans/archive-phase-r-a.md`
Phase A (EVM削除+vitest統一+fire-and-forget可視化): `plans/archive-phase-r-a.md`

**R.3 手動TODO**: GitHub Description/Topics/Website URL 設定 (knowmint.shop)

---

## Phase OB-1: エラー可視性強化 [P2 — 可観測性]

> Codex レビューで発見したサイレントエラー抑制の残件。障害時の原因調査を困難にしている。

- [ ] `src/lib/knowledge/queries.ts:142` — `getPublishedKnowledge()` の DB エラーを空配列に変換せず `console.error` でログ出力 `cc:TODO`
- [ ] `src/lib/api/auth.ts:41` — APIキールックアップ失敗時に `console.error` 追加 (インフラ障害と認証失敗を区別) `cc:TODO`
- [ ] `src/app/api/v1/knowledge/[id]/route.ts:42` — reviews クエリの `error` フィールドを無視せずログ出力 `cc:TODO`

---

## Phase PROD-TEST: 本番 devnet 購入テスト [P1 — 本番検証]

> ローカルテスト完了済み。本番インフラ（CF Workers + Supabase prod + Solana RPC）の動作確認。
> ユーザーゼロの今がリスクゼロで試せるタイミング。

- [ ] GitHub Variables: `NEXT_PUBLIC_SOLANA_NETWORK` → `devnet` `cc:TODO`
- [ ] GitHub Secrets: `NEXT_PUBLIC_SOLANA_RPC_URL` → `https://api.devnet.solana.com` `cc:TODO`
- [ ] 空コミット push → 本番デプロイ完了確認 `cc:TODO`
- [ ] Phantom をdevnet切り替え + faucet.solana.com でSOL取得 `cc:TODO`
- [ ] 本番で購入フロー E2E 確認（検索→詳細→購入→コンテンツ取得） `cc:TODO`
- [ ] **テスト完了後**: GitHub Variables/Secrets を mainnet に戻して再デプロイ（Show HN 前に必須） `cc:TODO`

---

## Phase SEC-1: エージェントによる出品ブロック [P2 — コンテンツ品質]

> `profiles.user_type = 'agent'` のユーザーが出品できてしまう。KnowMint のコアバリュー（人間の体験知）と矛盾するため、publish 時にチェックを追加する。
> 実効性は低い（自己申告制）が、抑止力として有効。変更箇所は1ファイル。

- [ ] `src/app/api/v1/knowledge/[id]/publish/route.ts` — publish 時に `profiles.user_type` を取得し `agent` なら 403 を返す `cc:TODO`
  - `admin.from("profiles").select("user_type").eq("id", user.userId).single()` で取得
  - `user_type === "agent"` → `apiError(API_ERRORS.FORBIDDEN, "Agents cannot publish knowledge items")`
  - item fetch の前（早期リターン）に配置

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

- [x] 26.1 デモシナリオ設計 + `scripts/demo/autonomous-purchase-demo.mjs` 作成 `cc:完了`
- [x] 26.2 Claude Code + MCP でデモ実行・キャプチャ `cc:完了`
- [x] 26.3 `asciinema rec` → GIF → README 埋め込み `cc:完了` / SNS投稿はユーザー手動
- [x] 26.4 Web UI トップに「How it works for AI Agents」セクション `cc:完了`

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
  - 対象: `src/app/api/v1/knowledge/[id]/route.ts:156` の PATCH ハンドラー
  - `createVersionSnapshot()` + `knowledge_items` update + `knowledge_item_contents` upsert の3書込みが非アトミック
  - 途中失敗でバージョン履歴とアイテムデータが不整合になる

---

## Phase 32.3: スマコン mainnet デプロイ `cc:DEFERRED`

> Phase 26 デモ・拡散の反響を見てから着手。P2P モードで十分運用可能。

- [ ] `anchor deploy --provider.cluster mainnet` → Program ID / Fee Vault 設定

---

## Phase UI-1: フッター X リンク追加 + Lighthouse 監査 [P2] (2026-03-01)

> SNS 導線追加とパフォーマンス・アクセシビリティの現状把握。

### UI-1.1 フッター X リンク追加

- [x] `Footer.tsx` の Brand セクション下に X (Twitter) リンクを追加 `cc:完了`
  - URL: https://x.com/gensou_ongaku
  - `target="_blank" rel="noopener noreferrer"` 必須
  - DQ スタイル (`text-dq-cyan hover:text-dq-gold`) 維持
  - X アイコン（SVG またはテキスト）を付ける

### UI-1.2 Lighthouse 監査

- [x] `lighthouse` CLI でローカル (`localhost:3000`) を計測 `cc:完了`
  - 計測対象: トップ・ナレッジ詳細・検索ページ（3ページ）
  - スコア記録: Performance / Accessibility / Best Practices / SEO
- [x] 指摘 (スコア < 80) があれば修正タスクを追加 `cc:完了`

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
