# Phase 10: セキュリティ修正 実装プラン

## Context

セキュリティレビュー (2026-02-21) で発見された HIGH/MEDIUM 脆弱性 3 件を修正する。
いずれも既存パターンの踏襲で解決できるシンプルな修正。

---

## Task 10.1: permissions ホワイトリスト検証 (HIGH)

### 問題
`POST /api/v1/keys` の `permissions` フィールドは型チェックのみで、
任意の文字列 (`"admin"`, `"superuser"` 等) を権限として設定したAPIキーを発行できる。
`keys/route.ts:18` の `admin` チェックが自己発行で突破される。

### 変更内容

#### 1. 新規: `src/lib/api/permissions.ts`
```typescript
export const ALLOWED_PERMISSIONS = ["read", "write", "admin"] as const;
export type Permission = typeof ALLOWED_PERMISSIONS[number];

export const PERMISSION_OPTIONS = [
  { value: "read",  label: "読み取り", description: "ナレッジ検索・取得" },
  { value: "write", label: "書き込み", description: "ナレッジ作成・更新" },
  { value: "admin", label: "管理者",   description: "全権限" },
] as const;
```

#### 2. 修正: `src/app/api/v1/keys/route.ts` 行85-93
既存の型チェック後に追加:
```typescript
import { ALLOWED_PERMISSIONS } from "@/lib/api/permissions";

// 既存チェック (型)
if (!Array.isArray(permissions) || permissions.some(p => typeof p !== "string")) { ... }

// 追加: 値のホワイトリスト検証
const invalid = permissions.filter(p => !(ALLOWED_PERMISSIONS as readonly string[]).includes(p));
if (invalid.length > 0) {
  return apiError(API_ERRORS.BAD_REQUEST, `Invalid permissions: ${invalid.join(", ")}`);
}
```

#### 3. 修正: `src/components/dashboard/ApiKeyManager.tsx` 行13-17
```typescript
// 削除: ローカル定義の PERMISSION_OPTIONS
import { PERMISSION_OPTIONS } from "@/lib/api/permissions";
```

#### 4. 新規マイグレーション: `supabase/migrations/20260221000016_phase10_security_fixes.sql`
```sql
-- api_keys permissions の CHECK 制約
ALTER TABLE api_keys
  ADD CONSTRAINT chk_api_keys_permissions
  CHECK (permissions <@ ARRAY['read','write','admin']::text[]);
```

### 影響ファイル
- `src/lib/api/permissions.ts` (新規)
- `src/app/api/v1/keys/route.ts`
- `src/components/dashboard/ApiKeyManager.tsx`
- `supabase/migrations/20260221000016_phase10_security_fixes.sql` (新規)

---

## Task 10.2: full_content サイズ制限 (MEDIUM)

### 問題
`full_content` フィールドに上限がなく、数GB の値を挿入してストレージコストを増大できる。
`title` (500文字) / `description` (10,000文字) / `request_content` (5,000文字) には制限があるのに `full_content` のみ未適用。

### 変更内容

#### 1. 修正: `src/app/api/v1/knowledge/route.ts` 行298付近 (POST)
title/description と同じパターンで追加:
```typescript
if (typeof fullContent === "string" && fullContent.length > 500_000) {
  return apiError(API_ERRORS.BAD_REQUEST, "full_content must be ≤ 500,000 characters");
}
```

#### 2. 修正: `src/app/api/v1/knowledge/[id]/route.ts` 行136-138 (PATCH)
既存の型チェックの後に追加:
```typescript
if (body.full_content !== undefined && typeof body.full_content !== "string") { ... }
// 追加
if (typeof body.full_content === "string" && body.full_content.length > 500_000) {
  return apiError(API_ERRORS.BAD_REQUEST, "full_content must be ≤ 500,000 characters");
}
```

#### 3. マイグレーション: `20260221000016_phase10_security_fixes.sql` に追記
```sql
-- knowledge_item_contents の full_content サイズ制限
ALTER TABLE knowledge_item_contents
  ADD CONSTRAINT chk_full_content_length
  CHECK (full_content IS NULL OR char_length(full_content) <= 500000);
```

### 影響ファイル
- `src/app/api/v1/knowledge/route.ts`
- `src/app/api/v1/knowledge/[id]/route.ts`
- `supabase/migrations/20260221000016_phase10_security_fixes.sql`

---

## Task 10.3: Webhook シークレット保護 (MEDIUM)

### 問題
`webhook_subscriptions.secret` が平文のままDBに保存される。
APIキーは SHA-256 ハッシュ化して保存しているのに、Webhookシークレットは平文。
DBが漏洩した場合、全シークレットを使った偽造署名が可能になる。

### 設計上の制約
Webhook 署名 (HMAC-SHA256) にはシークレットの平文が必要なため、APIキーと同じ「ハッシュのみ保存」はできない。
→ **APIキーと同じパターン適用**: 生成時のみ平文を返却し、DBには SHA-256 ハッシュを保存する。
Webhook送信ロジック実装時は、シークレットを再発行する API (`POST /api/v1/webhooks/:id/regenerate`) を用意する設計とする（今回は送信ロジック未実装なので現時点では使われない）。

### 変更内容

#### 1. 修正: `src/app/api/v1/webhooks/route.ts`

**POST ハンドラ (行108-125):**
```typescript
// auth.ts の generateApiKey() を参考に
const secretHash = await sha256(secret); // 既存の sha256 helper 使用、または inline

await admin.from("webhook_subscriptions").insert({
  user_id: user.userId,
  url,
  events,
  secret_hash: secretHash,  // ← ハッシュのみ保存
  active: true,
});

// 生成時のみ平文を返却 (再表示不可)
return apiSuccess({ ...data, secret }, 201);
```

**GET ハンドラ:** `secret_hash` を select から除外 (既に `secret` を返していないか確認)

#### 2. マイグレーション: `20260221000016_phase10_security_fixes.sql` に追記
```sql
-- webhook_subscriptions: secret を secret_hash に移行
ALTER TABLE webhook_subscriptions
  ADD COLUMN secret_hash TEXT;

-- 既存データのマイグレーション (既存シークレットは再発行できないため削除)
-- 既存の webhook は secret_hash = NULL のまま → 再登録を促す
UPDATE webhook_subscriptions SET secret_hash = NULL WHERE secret IS NOT NULL;

ALTER TABLE webhook_subscriptions
  ALTER COLUMN secret DROP NOT NULL,
  ADD CONSTRAINT chk_secret_hash_format CHECK (secret_hash IS NULL OR secret_hash ~ '^[0-9a-f]{64}$');

-- 新規 INSERT は secret_hash NOT NULL を将来的に強制 (移行完了後に別マイグレーションで)
```

#### 3. SHA-256 ヘルパー確認
`src/lib/api/auth.ts` に SHA-256 計算が実装済みのため、そのパターンを再利用する:
```typescript
// auth.ts のパターン
const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
```

### 影響ファイル
- `src/app/api/v1/webhooks/route.ts`
- `supabase/migrations/20260221000016_phase10_security_fixes.sql`

---

## 共通マイグレーションファイル

`supabase/migrations/20260221000016_phase10_security_fixes.sql` に全 DB 変更をまとめる。
(最新マイグレーション: `20260221000015_phase9_versioning.sql`)

---

## 実装順序

1. `src/lib/api/permissions.ts` 作成 (10.1 の基盤)
2. `src/app/api/v1/keys/route.ts` 修正 (10.1)
3. `src/components/dashboard/ApiKeyManager.tsx` 修正 (10.1)
4. `src/app/api/v1/knowledge/route.ts` 修正 (10.2 POST)
5. `src/app/api/v1/knowledge/[id]/route.ts` 修正 (10.2 PATCH)
6. `src/app/api/v1/webhooks/route.ts` 修正 (10.3)
7. `supabase/migrations/20260221000016_phase10_security_fixes.sql` 作成 (全DB変更)

---

## 検証方法

```bash
# ビルドチェック
npm run build

# lint
npm run lint

# 手動テスト (開発サーバー起動後)
# 10.1: 不正な permissions でキー発行 → 400 エラーを確認
curl -X POST /api/v1/keys -d '{"name":"test","permissions":["superuser"]}'
# → {"error": "Invalid permissions: superuser"}

# 10.2: 大きな full_content で出品 → 400 エラーを確認
# → {"error": "full_content must be ≤ 500,000 characters"}

# 10.3: Webhook 登録レスポンスに secret が含まれ、GET では含まれないことを確認
curl -X POST /api/v1/webhooks ...  # → secret: "whsec_..."
curl -X GET  /api/v1/webhooks ...  # → secret フィールドなし
```
