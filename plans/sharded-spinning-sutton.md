# Phase 14: 運用基盤 実装プラン

## Context

本番スケールに向けた運用基盤の整備。
- **14.1**: プロセス内 Map によるレート制限は Vercel マルチインスタンス環境で機能しない → Upstash Redis へ移行
- **14.2**: 重要操作（キー発行・購入・公開）の監査証跡がない → audit_logs テーブルと fire-and-forget ログ書き込み
- **14.3**: docs/openapi.yaml に Phase 7〜11 で追加されたエンドポイントが未記載 → spec 同期

---

## 14.1 レート制限 Redis 移行

### 変更ファイル
- `package.json` — `@upstash/ratelimit`, `@upstash/redis` 追加
- `src/lib/api/rate-limit.ts` — Redis 優先、失敗時はメモリ Map フォールバック
- `.env.local.example` — Upstash 変数追加

### 実装方針

```typescript
// src/lib/api/rate-limit.ts
// 1. 環境変数が揃っている場合: Upstash Ratelimit (Sliding Window)
// 2. 未設定 or 接続失敗: 既存 in-memory Token Bucket にフォールバック

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redisRatelimiter: Ratelimit | null = null;

function getRedisRatelimiter() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (redisRatelimiter) return redisRatelimiter;
  try {
    const redis = new Redis({ url: ..., token: ... });
    redisRatelimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m") });
    return redisRatelimiter;
  } catch { return null; }
}

export async function checkRateLimit(keyId: string): Promise<RateLimitResult> {
  const limiter = getRedisRatelimiter();
  if (limiter) {
    try {
      const { success, remaining, reset } = await limiter.limit(`key:${keyId}`);
      return { allowed: success, remaining, reset };
    } catch { /* fallthrough to memory */ }
  }
  return memoryCheckRateLimit(keyId); // 既存実装を rename して保持
}
```

**環境変数追加** (`.env.local.example`):
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

---

## 14.2 監査ログ

### 変更ファイル
- `supabase/migrations/20260222000018_phase14_audit_logs.sql` (新規)
- `src/lib/audit/log.ts` (新規)
- `src/app/api/v1/keys/route.ts` — POST (key.created) / DELETE (key.deleted)
- `src/app/api/v1/knowledge/[id]/purchase/route.ts` — POST (purchase.completed)
- `src/app/api/v1/knowledge/[id]/publish/route.ts` — POST (listing.published)
- `src/app/api/v1/webhooks/route.ts` — POST (webhook.created) / DELETE (webhook.deleted)

### マイグレーション

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,          -- 'key.created', 'purchase.completed' など
  resource_type TEXT,                 -- 'api_key', 'knowledge_item', 'webhook'
  resource_id TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);

-- RLS: 管理者のみ読み取り可能（API route は Admin クライアントで直接書き込み）
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON audit_logs FOR SELECT USING (false);
```

### `src/lib/audit/log.ts`

```typescript
import { getAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  | "key.created" | "key.deleted"
  | "purchase.completed"
  | "listing.published"
  | "webhook.created" | "webhook.deleted";

interface AuditLogParams {
  userId: string | null;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

// fire-and-forget — reject handler 必須
export function logAuditEvent(params: AuditLogParams): void {
  const supabase = getAdminClient();
  supabase.from("audit_logs").insert({
    user_id: params.userId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    metadata: params.metadata ?? {},
  }).then(() => {}, (err) => {
    console.error("[audit] failed to write log:", err);
  });
}
```

### API route への組み込みパターン

```typescript
// 成功レスポンス直前に呼び出し (fire-and-forget)
logAuditEvent({
  userId: user.id,
  action: "key.created",
  resourceType: "api_key",
  resourceId: newKeyId,
  metadata: { permissions, name },
});
```

---

## 14.3 OpenAPI spec 同期

### 変更ファイル
- `docs/openapi.yaml`

### 追加エンドポイント

以下は実装済みルート (`src/app/api/v1/`) だが OpenAPI spec に未記載:

| パス | メソッド | 説明 |
|------|---------|------|
| `/api/v1/knowledge/{id}/feedback` | POST | 有用性フィードバック |
| `/api/v1/knowledge/{id}/versions` | GET | バージョン履歴 |
| `/api/v1/knowledge/batch` | GET | バッチ取得 |
| `/api/v1/knowledge/{id}/preview` | GET | プレビュー取得 |
| `/api/v1/favorites` | GET/POST/DELETE | お気に入り管理 |
| `/api/v1/categories` | GET | カテゴリー一覧 |
| `/api/v1/webhooks` | GET/POST/DELETE | Webhook 管理 |
| `/api/v1/webhooks/{id}/regenerate` | POST | シークレット再発行 |

> 注: session-1771 で `purchase/`, `content/`, `preview/`, `batch/`, `categories/` が変更済み。
> 実装内容を各ファイルで確認してから spec を記述する。

`servers[].url` を `https://knowledge-market.vercel.app` に更新。

---

## 実装順序

1. **14.1** `package.json` に `@upstash/ratelimit` + `@upstash/redis` 追加
2. **14.1** `src/lib/api/rate-limit.ts` を Redis 優先 + メモリフォールバック に書き換え
3. **14.1** `.env.local.example` 更新
4. **14.2** マイグレーション SQL 作成
5. **14.2** `src/lib/audit/log.ts` 作成
6. **14.2** 各 API route に `logAuditEvent` 組み込み (5ファイル)
7. **14.3** `docs/openapi.yaml` の不足エンドポイント追記 + servers 更新
8. **Codex レビュー** Security/Performance/Quality — 指摘ゼロになるまで反復

---

## 検証方法

- `npm run build` でコンパイルエラーがないこと
- `UPSTASH_REDIS_*` を未設定にした状態でも API が動作する（フォールバック動作確認）
- `npm run lint` でエラーなし
- audit_logs への書き込みが fire-and-forget で行われ、失敗しても API レスポンスに影響しないこと
- OpenAPI yaml が有効な YAML であること（`npx @redocly/cli lint docs/openapi.yaml`）

---

## 注意事項

- Rate limit フォールバック時は `console.warn` でサイレントに降格
- audit log の書き込み失敗は `console.error` のみ（API レスポンスには影響しない）
- `@upstash/ratelimit` は Edge Runtime 対応だが、本プロジェクトは Node.js runtime なので問題なし
- OpenAPI の servers.url は環境によって変わるため、コメントで補足を残す
