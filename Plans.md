# KnowMint - 開発計画

> 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス
> 決済: Solana (ノンカストディアル P2P → スマートコントラクト自動分配)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: 人間が出品 → AIエージェント(OpenClaw等)が自律発見・購入
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。Maestro E2E: 18フロー (21/22 ページ, 95%)

---

## Phase 26: 自律購入デモ動画 [P1 — 訴求コンテンツ]

> 「AIエージェントが知識を自律購入した」実証動画。最強のマーケティング素材。
> 前提: Phase 40 (自律オンボーディング) ✅完了。着手可能。

- [ ] 26.1 デモシナリオ設計 + `scripts/demo/autonomous-purchase-demo.mjs` 作成
- [ ] 26.2 Claude Code + MCP でデモ実行・キャプチャ
- [ ] 26.3 `asciinema rec` → GIF → README + SNS 投稿
- [ ] 26.4 Web UI トップに「How it works for AI Agents」セクション

---

## Phase 32.3: スマコン mainnet デプロイ `cc:DEFERRED`

> Phase 26 デモ・拡散の反響を見てから着手。P2P モードで十分運用可能。

- [ ] `anchor deploy --provider.cluster mainnet` → Program ID / Fee Vault 設定

---

## Phase 33: 品質担保機能 [P1]

> 無料tier: 証拠フィールド必須化 + ティア型プレビュー。有料tier (33.3): 将来フェーズ。

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

## Phase 41-44, 46: ゼロから再設計レビュー改善 `cc:DONE`

> 「ゼロから再設計するなら」レビューに基づく全面改善。121ファイル変更、+7551/-5683行。
>
> - **41 型安全性**: `Database<>` 型を全 Supabase クライアントに適用、`as unknown as` 全廃、`toSingle<T>()` で nested join 正規化、`supabase.types.ts` 削除統合
> - **42 アーキテクチャ**: Server Action + カスタムフック (`useFavorite`/`useFollow`/`useNotifications`) で Client→DB 直接アクセス廃止、カテゴリ fetch も Server Action 経由に
> - **43 API 品質**: POST /keys→201、/health→apiSuccess、/publish 冪等フル返却、/purchase フォールバック修正、webhook fail-close 統一、ログ prefix 統一、OpenAPI 同期
> - **44 i18n**: `Social`/`VersionHistory`/`Notifications` namespace 追加、SellerRankingCard 内部化、en/ja 完備
> - **46 マイグレーション**: 29本→1本スクワッシュ (1,420行)、旧ファイル `_archived/` 保存

---

## 設計メモ

- **⑤⑥ EVM**: 意図的未対応 (Solana 優先)。将来フェーズで対応。
- **38.5 法的ページ i18n**: 言語固有性が高く英訳に法的チェック要。将来フェーズ。

## Phase 45: テスト拡充 `cc:DONE`

> Vitest + RTL セットアップ、Server Actions / queries / コンポーネント / i18n 完全性テスト追加。

---

## Phase 47: CI 型安全パイプライン [P1 — 堅牢性]

> Database 型が手書き。マイグレーション追加時に型ファイルとの乖離が無チェックで発生する。

- [ ] 47.1 `supabase gen types typescript` → `src/types/database.types.ts` 自動生成スクリプト作成 `cc:TODO`
- [ ] 47.2 CI で `supabase gen types` → `git diff --exit-code` チェック追加 (型乖離検出) `cc:TODO`
- [ ] 47.3 `npm run build` を CI に組み込み (型エラー = ビルド失敗) `cc:TODO`

---

## Phase 48: Rate Limit 障害耐性 [P2 — 可用性]

> Upstash 障害時、in-memory fallback が CF Workers のリクエスト隔離で無効。rate limit ゼロになる。

- [ ] 48.1 Upstash 障害時の挙動調査 + CF Workers 対応方針決定 `cc:TODO`
- [ ] 48.2 fallback 戦略実装 (固定レート許可 or 503 返却 or CF WAF 連携) `cc:TODO`
- [ ] 48.3 Upstash ヘルスチェック + `/health` エンドポイントに rate limit status 追加 `cc:TODO`

---

## Phase 49: E2E カバレッジ拡大 [P2 — 品質]

> Maestro 18フロー/95%で停止。library/[id] 未カバー + Phase 42 リファクタ後の動作確認。

- [ ] 49.1 `/library/[id]` E2E フロー追加 (購入済みコンテンツ表示) `cc:TODO`
- [ ] 49.2 FavoriteButton / FollowButton のリファクタ後 E2E 動作確認フロー `cc:TODO`
- [ ] 49.3 NotificationBell の Server Action 経由動作確認フロー `cc:TODO`

---

## Phase 50: UX 残件 [P3 — 品質]

> Phase 38.R で次フェーズ送りにしたアクセシビリティ・UX 改善。

- [ ] 50.1 Modal focus trap 実装 (Tab キーがモーダル外に出ない) `cc:TODO`
- [ ] 50.2 `updateListing` を RPC トランザクション化 (version snapshot + update の原子性) `cc:TODO`

---

## Phase 51: git history クリーンアップ [P3 — セキュリティ]

> devnet keypair が git history に残存。低リスクだが本番前に対応推奨。

- [ ] 51.1 `git filter-repo` で keypair ファイル除去 `cc:TODO`
- [ ] 51.2 force push 後のチーム通知 + clone 再実行手順ドキュメント `cc:TODO`

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
