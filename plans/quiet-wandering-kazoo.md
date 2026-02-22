# Phase 11: Webhook イベント配信 + SSRF修正

## Context

Phase 10のWebhook管理API（登録/削除/一覧）は完成済み。
- 現在の問題1: `isPublicUrl`がホスト名ベースのチェックのみで、DNS解決後のIPを検証しないためSSRF脆弱性が残存
- 現在の問題2: Webhook配信ロジック（dispatch/retry）が未実装 — 登録できるが通知が届かない
- 現在の問題3: `secret_hash`（SHA-256）からHMACキーを復元できないため、署名付き配信には`secret_encrypted`（AES-GCM）が必要

**目的**: 購入完了・レビュー・出品公開の3イベントをWebhookで通知できるようにする（OpenClaw自律購入デモの前提）

---

## 実装計画

### Step 1: DBマイグレーション (新規)

**ファイル**: `supabase/migrations/20260221000017_phase11_webhook_secret_encrypted.sql`

```sql
ALTER TABLE webhook_subscriptions
  ADD COLUMN IF NOT EXISTS secret_encrypted TEXT;
```

---

### Step 2: isPublicUrl SSRF修正 (変更)

**ファイル**: `src/app/api/v1/webhooks/route.ts`

現状の問題:
- ホスト名ベースのみ → DNS解決でリダイレクト可能
- IPv6 ULA (`fc00::/7`) / link-local (`fe80::/10`) が未対応
- IPv4-mapped IPv6 (`::ffff:127.0.0.1`) が未対応
- `0.0.0.0/8`, `100.64.0.0/10`(CGNAT) が未対応

修正後:
```typescript
import { promises as dns } from "node:dns";

// isPrivateIp(ip): IPv4/IPv6の非公開範囲チェック
// ブロック範囲: 0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16,
//               100.64/10(CGNAT), ::1, fc00::/7, fe80::/10, ::ffff:0/96

async function isPublicUrl(urlStr: string): Promise<boolean> {
  const u = new URL(urlStr);
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname;
  // IPリテラル → 直接チェック
  // ホスト名 → dns.lookup({ all: true }) → 全Aレコードチェック
  const results = await dns.lookup(host, { all: true });
  return results.every(({ address }) => !isPrivateIp(address));
}
```

`POST /api/v1/webhooks` ハンドラの `isPublicUrl` 呼び出しを `await isPublicUrl(...)` に変更。

---

### Step 3: Webhook暗号化ユーティリティ (新規)

**ファイル**: `src/lib/webhooks/crypto.ts`

- `encryptSecret(plaintext: string): string` — AES-256-GCM暗号化、フォーマット: `${ivHex}.${dataHex}.${tagHex}`
- `decryptSecret(encrypted: string): string` — 復号

環境変数: `WEBHOOK_SIGNING_KEY` (32バイト = 64文字のhex)

---

### Step 4: dispatch.ts (新規)

**ファイル**: `src/lib/webhooks/dispatch.ts`

```typescript
export async function dispatchWebhook(
  sub: { id: string; url: string; secret_encrypted: string | null },
  payload: { event: string; data: unknown; timestamp: string }
): Promise<{ success: boolean; statusCode?: number; error?: string }>
```

- `secret_encrypted` が NULL → 配信スキップ (`error: "no_signing_secret"`)
- `decryptSecret` で平文復号 → HMAC-SHA256 (`X-KM-Signature: sha256=<hex>`)
- タイムアウト 10秒 (AbortController)
- ヘッダー: `X-KM-Event`, `X-KM-Signature`, `User-Agent: KnowledgeMarket-Webhook/1.0`

---

### Step 5: retry.ts (新規)

**ファイル**: `src/lib/webhooks/retry.ts`

```typescript
export async function dispatchWithRetry(sub, payload, maxRetries = 3): Promise<void>
```

- 指数バックオフ: attempt 1→1秒, 2→2秒, 3→4秒
- `no_signing_secret` は即時終了（リトライしない）
- 全リトライ失敗でエラーログのみ（例外はスローしない）

---

### Step 6: events.ts — イベント発火ヘルパー (新規)

**ファイル**: `src/lib/webhooks/events.ts`

```typescript
export async function fireWebhookEvent(
  userId: string,
  event: "purchase.completed" | "review.created" | "listing.published",
  data: Record<string, unknown>
): Promise<void>
```

- Admin Supabase で `webhook_subscriptions` を `user_id` + `active=true` + `events @> [event]` でフィルタ
- `Promise.all` で全サブスクリプションへ並列配信
- fire-and-forget: `.catch(err => console.error(...))`

---

### Step 7: regenerate API (新規)

**ファイル**: `src/app/api/v1/webhooks/[id]/regenerate/route.ts`

```
POST /api/v1/webhooks/:id/regenerate
権限: write
```

処理:
1. webhook の `user_id` が `user.userId` と一致するか確認（所有者チェック）
2. 32バイトシークレット生成 → `whsec_` prefix付き平文
3. SHA-256 ハッシュ → `secret_hash`
4. AES-256-GCM暗号化 → `secret_encrypted`
5. DB更新: `secret_hash`, `secret_encrypted`, `active=true`
6. 平文を1回だけレスポンスで返す（再表示不可）

パターン: `withApiAuth(handler, { requiredPermissions: ["write"] })`

---

### Step 8: イベント発火の組み込み (変更)

**purchase/route.ts** (`src/app/api/v1/knowledge/[id]/purchase/route.ts`):
- `confirm_transaction` RPC成功後にfire-and-forget:
  ```typescript
  fireWebhookEvent(user.userId, "purchase.completed", {
    knowledge_id: id, transaction_id: transaction.id, amount_sol: transaction.amount_sol,
  }).catch(err => console.error("Webhook:", err));
  ```

**feedback/route.ts** (`src/app/api/v1/knowledge/[id]/feedback/route.ts`):
- フィードバックINSERT成功後にfire-and-forget:
  ```typescript
  fireWebhookEvent(user.userId, "review.created", {
    knowledge_id: id, useful: body.useful,
  }).catch(err => console.error("Webhook:", err));
  ```

**publish/route.ts** (`src/app/api/v1/knowledge/[id]/publish/route.ts`):
- status更新成功後にfire-and-forget:
  ```typescript
  fireWebhookEvent(user.userId, "listing.published", {
    knowledge_id: id, title: item.title,
  }).catch(err => console.error("Webhook:", err));
  ```

---

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `supabase/migrations/20260221000017_phase11_webhook_secret_encrypted.sql` | 新規 |
| `src/lib/webhooks/crypto.ts` | 新規 |
| `src/lib/webhooks/dispatch.ts` | 新規 |
| `src/lib/webhooks/retry.ts` | 新規 |
| `src/lib/webhooks/events.ts` | 新規 |
| `src/app/api/v1/webhooks/[id]/regenerate/route.ts` | 新規 |
| `src/app/api/v1/webhooks/route.ts` | 変更 (isPublicUrl → DNS解決ベース) |
| `src/app/api/v1/knowledge/[id]/purchase/route.ts` | 変更 (イベント発火追加) |
| `src/app/api/v1/knowledge/[id]/feedback/route.ts` | 変更 (イベント発火追加) |
| `src/app/api/v1/knowledge/[id]/publish/route.ts` | 変更 (イベント発火追加) |

---

## 環境変数追加

`.env.local.example` に追記:
```
WEBHOOK_SIGNING_KEY=  # openssl rand -hex 32 で生成
```

---

## 実装戦略

- Step 1-3 → Step 4-6 → Step 7-8 の順序（依存関係あり）
- Step 4-6 は並列実装可能
- Step 7 は Step 3 完了後に並列実装可能

---

## Verification

1. `npm run build` — TypeScriptコンパイルエラーなし
2. `npm run lint` — ESLintエラーなし
3. 手動テスト:
   - `POST /api/v1/webhooks` に内部IP (`http://192.168.1.1`) を登録 → 400確認
   - `POST /api/v1/webhooks` に `http://localhost` → 400確認
   - `POST /api/v1/webhooks/:id/regenerate` → plaintext_secretが返る
   - `POST /api/v1/knowledge/:id/purchase` 後にWebhookがHTTP POSTされる（ローカルサーバーで受信確認）
4. Codexレビュー（セキュリティ/品質）
