# Codex レビュー指摘 一括修正計画

## Context

Phase 4 API 実装完了後、Codex 並列レビュー (Security/Performance/Quality) で Critical 2件 + High 12件が検出された。本計画はこれら全指摘を一括修正する。

## 修正対象サマリー

| 深刻度 | 件数 | 主な問題 |
|--------|------|---------|
| Critical | 2 | 購入額の未検証、エラーメッセージ漏洩 |
| High | 12 | SSRF、権限未実施、クライアント重複、DB負荷 |

---

## Fix A: 共通基盤の統合 (Quality High #10, #11 + Performance High #6)

### A1: `getAdminClient()` を共有モジュールに抽出

**新規**: `src/lib/supabase/admin.ts`
- singleton パターンでクライアントを再利用（毎リクエスト new 防止）
- 環境変数チェック付き
- `globalThis` キャッシュ（dev hot-reload 対応）

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  adminClient = createClient(url, key);
  return adminClient;
}
```

**修正対象**: 全9ルートファイル + `auth.ts` から `getAdminClient()` を削除し import に置換

### A2: `withApiAuth()` ミドルウェアラッパー

**新規**: `src/lib/api/middleware.ts`
- 認証 + レート制限 + レート制限ヘッダー付与を1関数に集約
- 各ルートハンドラのボイラープレート 30行 → 1行に

```typescript
type ApiHandler = (req: Request, user: AuthenticatedUser, rateLimit: RateLimitResult) => Promise<NextResponse>;

export function withApiAuth(handler: ApiHandler) {
  return async (request: Request, context?: any) => {
    const user = await authenticateApiKey(request);
    if (!user) return apiError(API_ERRORS.UNAUTHORIZED);
    const rl = checkRateLimit(user.keyId);
    if (!rl.allowed) return withRateLimitHeaders(apiError(API_ERRORS.RATE_LIMITED), rl.remaining, rl.resetMs);
    const response = await handler(request, user, rl);
    return withRateLimitHeaders(response, rl.remaining, rl.resetMs);
  };
}
```

**修正対象**: 全ルートファイルのハンドラをラップ

---

## Fix B: セキュリティ修正 (Critical #1, #2 + High #3, #4, #5)

### B1: 購入額の検証 (Critical)

**ファイル**: `src/app/api/v1/knowledge/[id]/purchase/route.ts`

- body の `amount` を無視し、DB の `price_sol` / `price_usdc` から期待額を算出
- `token` に応じて `price_sol` or `price_usdc` を使用
- 価格が null (無料アイテム) の場合はエラー

```typescript
// token に応じた期待額を取得
const expectedAmount = token === "USDC" ? item.price_usdc : item.price_sol;
if (expectedAmount === null || expectedAmount <= 0) {
  return apiError(API_ERRORS.BAD_REQUEST, "This item has no price set for the selected token");
}
// DB に保存する amount は期待額を使用 (クライアント値を信頼しない)
```

### B2: エラーメッセージの内部情報漏洩防止 (Security Medium)

**ファイル**: `src/app/api/v1/knowledge/route.ts` 行167, `purchase/route.ts` 行174

- `error.message` をクライアントに返さない
- 内部エラーは `console.error` でログし、クライアントには汎用メッセージのみ

### B3: Webhook URL バリデーション強化 (High)

**ファイル**: `src/app/api/v1/webhooks/route.ts`

- `URL` コンストラクタでパース（無効 URL を拒否）
- hostname がプライベート IP / localhost / リンクローカルを拒否
- userinfo (@) 禁止

```typescript
function isPublicUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname;
    if (host === "localhost" || host.startsWith("127.") || host === "[::1]") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.startsWith("169.254.")) return false;
    return true;
  } catch { return false; }
}
```

### B4: パーミッション実施 (High)

**ファイル**: `src/lib/api/middleware.ts` (A2 で新規作成するファイル)

- `withApiAuth()` に `requiredPermissions` オプション追加
- 読み取り系: `["read"]`, 書き込み系: `["write"]`, キー管理: `["admin"]`
- 各ルートで適切な権限を指定

| エンドポイント | メソッド | 必要権限 |
|--------------|---------|---------|
| knowledge GET | GET | `read` |
| knowledge POST | POST | `write` |
| purchase POST | POST | `write` |
| keys POST/DELETE | POST/DELETE | `admin` |
| webhooks POST/DELETE | POST/DELETE | `write` |

### B5: 認証前レート制限 (High)

**ファイル**: `src/lib/api/rate-limit.ts`

- IP ベースの pre-auth レート制限を追加 (`checkPreAuthRateLimit`)
- IP 単位で 120 req/min (認証成功後のキー単位より緩い)
- `withApiAuth()` 内で認証前に呼び出し

---

## Fix C: パフォーマンス修正 (High #7, #8, #9)

### C1: `last_used_at` 更新のスロットリング

**ファイル**: `src/lib/api/auth.ts`

- メモリ内で最終更新時刻を保持、5分未満なら更新スキップ
- `.catch(() => {})` 追加

### C2: `count: "exact"` の除去

**ファイル**: `src/app/api/v1/knowledge/route.ts`

- `count: "exact"` → `count: "estimated"` に変更（パフォーマンス改善）
- 正確なカウントが必要な場合は `?exact_count=true` パラメータで切替

### C3: reviews の LIMIT 追加

**ファイル**: `src/app/api/v1/knowledge/[id]/route.ts`

- `.limit(20)` を reviews クエリに追加

---

## Fix D: その他品質改善

### D1: fire-and-forget に `.catch()` 追加

**ファイル**: `src/lib/api/auth.ts`, `src/app/api/v1/knowledge/[id]/route.ts`

### D2: セキュリティヘッダー追加

**ファイル**: `src/lib/api/response.ts`

- `apiSuccess` / `apiError` にセキュリティヘッダーを付与:
  - `Cache-Control: no-store`
  - `X-Content-Type-Options: nosniff`

---

## 実装順序

### Wave 1: 共通基盤 (直接実装、後続の前提)
1. `src/lib/supabase/admin.ts` — singleton admin client
2. `src/lib/api/middleware.ts` — withApiAuth + 権限チェック
3. `src/lib/api/rate-limit.ts` — pre-auth レート制限追加
4. `src/lib/api/auth.ts` — last_used_at スロットリング + .catch()
5. `src/lib/api/response.ts` — セキュリティヘッダー追加

### Wave 2: ルートファイル修正 (並列3ワーカー)
- Worker A: `knowledge/route.ts` + `knowledge/[id]/route.ts` + `knowledge/batch/route.ts`
  - getAdminClient import 置換, withApiAuth ラップ, count:estimated, reviews limit
- Worker B: `knowledge/[id]/purchase/route.ts` + `knowledge/[id]/content/route.ts` + `knowledge/[id]/preview/route.ts`
  - getAdminClient import 置換, withApiAuth ラップ, 購入額検証, エラーメッセージ修正
- Worker C: `categories/route.ts` + `keys/route.ts` + `webhooks/route.ts`
  - getAdminClient import 置換, withApiAuth ラップ, URL バリデーション強化, 権限指定

---

## 修正対象ファイル一覧

| ファイル | 修正内容 |
|---------|---------|
| `src/lib/supabase/admin.ts` | **新規** singleton admin client |
| `src/lib/api/middleware.ts` | **新規** withApiAuth ラッパー |
| `src/lib/api/auth.ts` | last_used_at スロットリング, .catch(), getAdminClient → import |
| `src/lib/api/rate-limit.ts` | pre-auth レート制限追加 |
| `src/lib/api/response.ts` | セキュリティヘッダー追加 |
| `src/app/api/v1/knowledge/route.ts` | withApiAuth, count:estimated, エラーメッセージ修正 |
| `src/app/api/v1/knowledge/[id]/route.ts` | withApiAuth, reviews limit, .catch() |
| `src/app/api/v1/knowledge/[id]/preview/route.ts` | withApiAuth |
| `src/app/api/v1/knowledge/[id]/content/route.ts` | withApiAuth |
| `src/app/api/v1/knowledge/[id]/purchase/route.ts` | withApiAuth, 購入額検証, エラーメッセージ修正 |
| `src/app/api/v1/knowledge/batch/route.ts` | withApiAuth |
| `src/app/api/v1/categories/route.ts` | withApiAuth |
| `src/app/api/v1/keys/route.ts` | withApiAuth, admin 権限 |
| `src/app/api/v1/webhooks/route.ts` | withApiAuth, URL バリデーション強化 |

## 検証方法

```bash
npm run build   # TypeScript コンパイル + ルート生成確認
npm run lint    # ESLint (新規ファイルのエラーなし)
```
