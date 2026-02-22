# アーカイブ: Phase 11–14

---

## Phase 11: Webhook イベント配信 + SSRF修正 `cc:DONE`

> Codex レビュー 6 ラウンド → LGTM, harness-review 2 ラウンド → グレードA

### 11.1 isPublicUrl SSRF 修正
- `src/lib/webhooks/ssrf.ts` — DNS解決ベースSSRF防御、IPv6 16バイト展開、`checkPublicUrl()` 構造化レスポンス、undici Agent IP ピン留め
- `webhooks/route.ts` — `checkPublicUrl` 採用、URL 2048文字上限、events 10件上限、subscription 25件/ユーザー上限

### 11.2 Webhook イベント配信サービス
- `src/lib/webhooks/crypto.ts` — AES-256-GCM 暗号化
- `src/lib/webhooks/dispatch.ts` — HMAC-SHA256 署名付き HTTP 配信 + IP ピン留め
- `src/lib/webhooks/retry.ts` — 指数バックオフ再試行 (3回, 1s/2s, jitter ±10%)
- `src/lib/webhooks/events.ts` — `fireWebhookEvent()` bounded concurrency (max 10)
- 購入完了・レビュー作成・出品公開の3イベント発火を各 route に組み込み

### 11.3 Webhook シークレット再発行 API
- `POST /api/v1/webhooks/[id]/regenerate` — 平文を1回だけ返却、AES-GCM 暗号化保存
- `supabase/migrations/20260221000017_phase11_webhook_secret_encrypted.sql`

### 11.4 品質・型整合
- `src/lib/audit/log.ts` — `feedback.created` AuditAction 追加
- `src/types/database.types.ts` — `WebhookSubscription` 型追加

---

## Phase 13: テスト基盤強化 `cc:DONE`

> Codex レビュー 3 ラウンド → LGTM, harness-review → 全 Warning 対応済み
> **最終テスト数: ユニット 64件 / 統合 28件 (全グリーン)**

### 13.1 API ユニットテスト
- `tests/unit/api/auth.test.ts` — generateApiKey 5ケース
- `tests/unit/api/permissions.test.ts` — ALLOWED_PERMISSIONS 7ケース
- `tests/unit/api/validation.test.ts` — validateExpiresAt 15ケース (当日日付のみ形式含む)
- `tests/unit/knowledge/metadata.test.ts` — sanitizeMetadata 9ケース
- `tests/unit/knowledge/requestContent.test.ts` — normalizeRequestContent/build/parse 10ケース
- `tests/unit/webhooks/ssrf.test.ts` — isPrivateIp() 18ケース

### 13.2 API 統合テスト
- `tests/integration/keys.integration.test.ts` — POST /api/v1/keys 11ケース (403 含む)
- `tests/integration/knowledge.integration.test.ts` — POST /api/v1/knowledge 8ケース
- `tests/integration/webhooks.integration.test.ts` — POST /api/v1/webhooks 10ケース (403/SSRF)
- `tests/integration/helpers/supabase-mock.ts` — `require.cache` 注入モックヘルパー

### 13.3 テスト実行環境整備
- `tsconfig.test.json` — CJS 互換 (Mocha + ts-node)
- `package.json` — `test:unit` / `test:integration` スクリプト
- `node:assert/strict` 統一 (chai@6 ESM-only 問題を回避)
- `src/lib/api/validation.ts` — `validateExpiresAt()` 抽出

### harness-review 指摘対応
- `webhooks/route.ts` — `webhook_id` UUID_RE バリデーション、countError/上限超過エラー分離
- `validation.test.ts` — reason チェック一貫性、当日日付設計意図テスト追加
- 統合テスト — 権限不足 403 Forbidden ケース追加

---

## Phase 14: 運用基盤 `cc:DONE`

> レート制限の永続化・監査ログ・OpenAPI 同期。

### 14.1 レート制限 Redis 移行
- `src/lib/api/rate-limit.ts` — プロセス内 Map → Upstash Redis (@upstash/ratelimit)
- フォールバック: Redis 接続失敗時はプロセス内 Map (可用性優先)
- `.env.local.example` に `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` 追加

### 14.2 監査ログ
- `supabase/migrations/20260222000018_phase14_audit_logs.sql` — `audit_logs` テーブル
- `src/lib/audit/log.ts` — fire-and-forget ログ書き込み
- キー発行・削除、購入、出品公開、Webhook 登録・削除に組み込み

### 14.3 OpenAPI spec 同期
- `docs/openapi.yaml` に `/batch`, `/preview`, `/feedback`, `/versions`, `/favorites`, `/categories`, `/webhooks`, `/webhooks/{id}/regenerate` を追加
- `servers[].url` を `https://knowledge-market.vercel.app` に更新

### セキュリティ強化 (harness-review 指摘対応)
- `keys/route.ts` — `checkPreAuthRateLimit` 全ハンドラ追加、UUID バリデーション、name 255文字上限
- `rate-limit.ts` — IP 取得を `x-real-ip` 優先 (Vercel Proxy 対応)
- `ssrf.ts` — `dns_notfound` / `dns_error` 分離、`checkPublicUrl` 構造化レスポンス
- `audit_logs` RLS — `FOR ALL USING (false) WITH CHECK (false)`
