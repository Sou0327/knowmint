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
- **Phase 5-6** `cc:DONE`: CLI/MCP/スマートコントラクト決済 devnet デプロイ → `plans/archive-phase5-6.md`
- **Phase 7** `cc:DONE`: ナレッジメタデータ強化 (Codexレビュー3ラウンド) → `plans/archive-phase6-10.md`
- **Phase 8** `cc:DONE`: コードベース整理 — EVM/i18n凍結 (Codexレビュー3ラウンド) → `plans/archive-phase6-10.md`
- **Phase 9** `cc:DONE`: 信頼スコア/バージョニング/SDK (Codexレビュー13ラウンド) → `plans/archive-phase6-10.md`
- **Phase 10** `cc:DONE`: セキュリティ修正 HIGH/MEDIUM (Codexレビュー4ラウンド LGTM) → `plans/archive-phase6-10.md`

---

## Phase 11: Webhook イベント配信 + SSRF修正 [P0] `[feature:security]`

> 最優先ゴール「OpenClawによる自律購入デモ」に必要な購入完了通知基盤。
> Webhook 管理 API (Phase 10) は完了済み。配信ロジックの実装を行う。

### 11.1 isPublicUrl SSRF 修正 `[feature:security]`

- [ ] `src/app/api/v1/webhooks/route.ts` — DNS 解決後のIPを CIDR ベースで検証
  - A/AAAA レコード取得 → loopback/private/link-local/ULA/metadata range を拒否
  - IPv6 ULA (`fc00::/7`) / link-local (`fe80::/10`) の禁止
  - Node.js `dns.promises.lookup` を使用 (Edge Runtime 非対応のため route handler で処理)
- [ ] テスト: 内部IPへの登録試行が 400 になることを E2E で確認

### 11.2 Webhook イベント配信サービス `[feature:security]`

- [ ] `src/lib/webhooks/dispatch.ts` (新規) — イベント HTTP 送信ロジック
  - HMAC-SHA256 署名生成 (`X-KM-Signature: sha256=<hex>`)
  - 署名には `secret_hash` が使えないため `regenerate` フローが必要 → **設計方針**: 初回配信時にシークレット再発行を促すエラーを返す (`re-register` 案)
  - タイムアウト 10秒、User-Agent ヘッダー付与
- [ ] `src/lib/webhooks/retry.ts` (新規) — 指数バックオフ再試行 (最大3回)
- [ ] 購入完了イベント発火: `src/app/api/v1/knowledge/[id]/purchase/route.ts` に組み込み
- [ ] レビュー作成イベント発火: `feedback` API に組み込み
- [ ] 出品公開イベント発火: `publish` API に組み込み

### 11.3 Webhook シークレット再発行 API

- [ ] `POST /api/v1/webhooks/[id]/regenerate` (新規) — 新シークレット生成 + `secret_hash` 更新
  - `withApiAuth` + `write` permission
  - 生成時のみ平文を返却 (再表示不可)
- [ ] マイグレーション: `webhook_subscriptions.secret_hash NOT NULL` 強制 (移行完了後)

**対象ファイル**: `src/lib/webhooks/`, `src/app/api/v1/webhooks/`, `src/app/api/v1/knowledge/[id]/purchase/route.ts`

---

## Phase 12: mainnet 移行準備 [P0]

> devnet 実証済み。mainnet への移行に必要な設定・検証を行う。

### 12.1 環境変数・設定整備

- [ ] `.env.local.example` を mainnet 変数で更新
  - `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
  - `NEXT_PUBLIC_KM_PROGRAM_ID` (mainnet デプロイ後に更新)
  - `NEXT_PUBLIC_FEE_VAULT_ADDRESS` (mainnet 用)
- [ ] `NEXT_PUBLIC_SOLANA_RPC_URL` を有料 RPC エンドポイント (Helius/QuickNode) に変更

### 12.2 Solana Program mainnet デプロイ

- [ ] `anchor deploy --provider.cluster mainnet-beta` 実行
- [ ] Program ID を `.env.local` と `CLAUDE.md` に反映
- [ ] mainnet Fee Vault アドレス生成・記録
- [ ] devnet テストと同等の smoke test を mainnet で実施

### 12.3 フロントエンド mainnet 対応確認

- [ ] ウォレット接続が mainnet-beta で正常動作することを確認
- [ ] トランザクション確認フローが mainnet RPC で動作することを確認
- [ ] Vercel 環境変数を mainnet 用に更新

**対象ファイル**: `.env.local.example`, `programs/`, Vercel ダッシュボード

---

## Phase 13: テスト基盤強化 [P1] `[feature:tdd]`

> E2E スクリプト 2本のみ → 主要ロジックのユニット/統合テストを整備する。

### 13.1 API ユニットテスト

- [ ] `src/lib/api/` のユニットテスト
  - `auth.ts`: generateApiKey / authenticateApiKey のハッシュ一致テスト
  - `permissions.ts`: ALLOWED_PERMISSIONS のホワイトリスト検証テスト
  - `keys/route.ts`: expires_at バリデーション (ISO 8601 / 過去日 / 存在しない日付)
- [ ] `src/lib/knowledge/` のユニットテスト
  - `metadata.ts`: sanitizeMetadata の許可リスト検証
  - `requestContent.ts`: normalizeRequestContent のエッジケース

### 13.2 API 統合テスト

- [ ] `POST /api/v1/keys` — 不正 permissions で 400、正常で 201
- [ ] `POST /api/v1/knowledge` — full_content 超過で 400
- [ ] `POST /api/v1/webhooks` — 内部 URL で 400 (Phase 11 と連動)
- [ ] 購入フロー: tx_hash 偽造で拒否されることを確認 (既存 fake-tx テストを拡張)

### 13.3 テスト実行環境整備

- [ ] `package.json` に `test:unit` / `test:integration` スクリプト追加
- [ ] CI 用に `npm run test:unit` が通るように設定

**対象ファイル**: `src/**/*.test.ts`, `package.json`

---

## Phase 14: 運用基盤 [P2] `cc:DONE`

> レート制限の永続化・監査ログ・OpenAPI 同期。本番スケールに向けた整備。

### 14.1 レート制限 Redis 移行

- [x] `src/lib/api/rate-limit.ts` をプロセス内 Map → Redis (Upstash) に移行
  - `@upstash/ratelimit` を使用
  - 環境変数: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - フォールバック: Redis 接続失敗時はプロセス内 Map に降格 (可用性優先)
  - Map サイズ上限 `MAX_BUCKETS = 10_000` でメモリリーク防止
- [x] `.env.local.example` に Upstash 変数を追加

### 14.2 監査ログ

- [x] `supabase/migrations/20260222000018_phase14_audit_logs.sql` — `audit_logs` テーブル作成
  - `user_id`, `action`, `resource_type`, `resource_id`, `metadata JSONB`, `created_at`
  - RLS: `FOR ALL USING (false) WITH CHECK (false)` + `action` CHECK 制約
- [x] `src/lib/audit/log.ts` (新規) — fire-and-forget でログ書き込み (`.throwOnError()` 付き)
- [x] API route の重要操作に組み込み: キー発行・削除, 購入, 出品公開, Webhook 登録・削除

### 14.3 OpenAPI spec 同期

- [x] `docs/openapi.yaml` に未記載エンドポイントを追加:
  - `/api/v1/knowledge/batch`
  - `/api/v1/knowledge/{id}/preview`
  - `/api/v1/knowledge/{id}/feedback`
  - `/api/v1/knowledge/{id}/versions`
  - `/api/v1/favorites`
  - `/api/v1/categories`
  - `/api/v1/webhooks`
  - `/api/v1/webhooks/{id}/regenerate` (Phase 11)
- [x] `servers[].url` を `https://knowledge-market.vercel.app` に更新

### セキュリティ強化 (harness-review 指摘対応)

- [x] `keys/route.ts` — IP プリオーソレート制限 (`checkPreAuthRateLimit`) を GET/POST/DELETE 全ハンドラに追加
- [x] `keys/route.ts` — UUID バリデーション、name 255文字上限、DELETE ゼロ件時 NOT_FOUND
- [x] `rate-limit.ts` — IP 取得を `x-real-ip` 優先 (Vercel Proxy 対応)
- [x] `ssrf.ts` — `dns_notfound` (NXDOMAIN) / `dns_error` (一時障害) を分離; `checkPublicUrl` 構造化レスポンス
- [x] `webhooks/route.ts` — `checkPublicUrl` 採用で DNS エラー分類 (400/500)、audit log URL サニタイズ
- [x] `audit_logs` RLS — `FOR ALL USING (false) WITH CHECK (false)` で INSERT/UPDATE/DELETE を全拒否

**対象ファイル**: `src/lib/api/rate-limit.ts`, `supabase/migrations/`, `src/lib/audit/`, `docs/openapi.yaml`

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
