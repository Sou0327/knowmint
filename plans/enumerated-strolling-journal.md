# Phase 13: テスト基盤強化 — 実装プラン

## Context

現在ユニット/統合テストが 0 件。devDependencies に Mocha + ts-mocha + chai は存在するが、
設定ファイルとテストコードが未整備。`chai@6.2.2` は ESM-only のため ts-mocha (CJS) から
`require()` すると `ERR_REQUIRE_ESM` になる点が最大の罠。
本プランでは `node:assert/strict` でアサーションを統一し、CI でサーバーなしで
`npm run test:unit` が通る構成を整える。

---

## 事前確認事項

- `tsconfig-paths` がインストール済みか → Plan agent は @4.2.0 インストール済みとしているが、
  実装前に `package.json` で確認する。未インストールなら `npm i -D tsconfig-paths` を追加。

---

## 実装手順

### Step 1: `src/lib/api/validation.ts` 新規作成（expires_at 抽出）

`src/app/api/v1/keys/route.ts` 内のインライン `expires_at` バリデーションを
ピュア関数 `validateExpiresAt()` に抽出する。

```typescript
// src/lib/api/validation.ts
export type ValidateExpiresAtResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateExpiresAt(
  value: unknown,
  now: Date = new Date()
): ValidateExpiresAtResult {
  if (value === undefined || value === null) return { valid: true };
  if (typeof value !== "string")
    return { valid: false, reason: "Field 'expires_at' must be a string" };

  const iso8601Re = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;
  if (!iso8601Re.test(value))
    return { valid: false, reason: "Field 'expires_at' must be a valid ISO 8601 date" };

  const parsed = new Date(value);
  if (isNaN(parsed.getTime()))
    return { valid: false, reason: "Field 'expires_at' must be a valid ISO 8601 date" };

  // カレンダー妥当性チェック（2026-02-30 等を拒否）
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const [y, m, d] = datePart.split("-").map(Number);
  const cal = new Date(Date.UTC(y, m - 1, d));
  if (cal.getUTCFullYear() !== y || cal.getUTCMonth() + 1 !== m || cal.getUTCDate() !== d)
    return { valid: false, reason: "Field 'expires_at' must be a valid ISO 8601 date" };

  if (parsed <= now)
    return { valid: false, reason: "Field 'expires_at' must be a future date" };

  return { valid: true };
}
```

`now` パラメータのデフォルトを `new Date()` にすることで、テスト時に任意の「現在時刻」を
注入でき、時刻依存のないテストが書ける。

**修正ファイル:** `src/app/api/v1/keys/route.ts`
インラインの expires_at バリデーション部分を `validateExpiresAt(expires_at)` の呼び出しに置換。

---

### Step 2: テスト実行環境 (13.3)

#### 新規: `tsconfig.test.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "noEmit": true,
    "isolatedModules": false
  }
}
```

`module: "commonjs"` + `moduleResolution: "node"` で ts-mocha (CJS) と互換にする。
`isolatedModules: false` で ts-node がファイルを直列トランスパイルできるようにする。

#### 修正: `package.json`

```json
"test:unit": "TS_NODE_PROJECT=tsconfig.test.json TS_CONFIG_PATHS=true ts-mocha 'tests/unit/**/*.test.ts'",
"test:integration": "TS_NODE_PROJECT=tsconfig.test.json TS_CONFIG_PATHS=true ts-mocha 'tests/integration/**/*.test.ts' --timeout 10000"
```

`TS_NODE_PROJECT` で専用 tsconfig を指定し、`TS_CONFIG_PATHS=true` で `@/*` エイリアスを解決する。

---

### Step 3: ユニットテスト作成 (13.1)（並列作成可）

**ディレクトリ:** `tests/unit/`

アサーションライブラリは全て `node:assert/strict` を使用（chai の ESM 問題を回避）。

#### `tests/unit/api/auth.test.ts`
```
generateApiKey()
  - raw が "km_" で始まること
  - raw が 67 文字 (km_ + 64hex) であること
  - hash が 64 文字の hex であること
  - SHA-256(raw) === hash であること（ハッシュ一致テスト）
  - 2 回呼んで異なる raw が生成されること
```

#### `tests/unit/api/permissions.test.ts`
```
ALLOWED_PERMISSIONS
  - ["read", "write", "admin"] の 3 要素であること
  - "read" / "write" / "admin" がそれぞれ含まれること
  - "superuser" / "delete" / "" は含まれないこと
```

#### `tests/unit/api/validation.test.ts`
```
validateExpiresAt()  ※ now = new Date('2026-02-22T12:00:00Z') で固定
  undefined / null → { valid: true }
  非文字列 (数値, boolean) → { valid: false }
  ISO 8601 形式違反: "2026/12/31", "2026-13-01", "not-a-date" → { valid: false }
  存在しない日付: "2026-02-29"(平年), "2026-04-31", "2026-02-30" → { valid: false }
  過去日: "2026-01-01", "2026-02-22T00:00:00Z" → { valid: false }
  正常ケース: "2026-12-31", "2027-01-01T00:00:00Z", "2026-03-01T12:00:00+09:00" → { valid: true }
```

#### `tests/unit/knowledge/metadata.test.ts`
```
sanitizeMetadata()
  null / 配列 / 文字列 → {}
  不正な domain 値 → フィールドが除去される
  有効な domain 値 → 保持される
  applicable_to が 11 件超 → 先頭 10 件にスライス
  applicable_to が非配列 → 除去される
  許可外キー ("injected_key: evil") → 除去される
```

#### `tests/unit/knowledge/requestContent.test.ts`
```
normalizeRequestContent()
  - undefined フィールド → "" になること
  - 前後スペースがトリムされること

buildRequestFullContent()
  - needed_info と background が含まれること
  - delivery_conditions が空のときセクションが省略されること
  - notes が空のときセクションが省略されること
  - 非空の delivery_conditions → "## 納品条件" セクションが含まれること

parseRequestFullContent()
  - buildRequestFullContent の出力でラウンドトリップすること
  - null/undefined → 空の ParsedContent を返すこと
  - セクションなしテキスト → needed_info にフォールバックすること
```

#### `tests/unit/webhooks/ssrf.test.ts`
```
isPrivateIp()
  プライベート IPv4: 127.0.0.1, 10.0.0.1, 192.168.1.1, 172.16.0.1, 172.31.255.255 → true
  CGNAT: 100.64.0.1, 100.127.255.255 → true
  CGNAT 外: 100.128.0.0 → false
  link-local: 169.254.0.1 → true
  パブリック: 8.8.8.8, 1.1.1.1 → false
  IPv6 プライベート: "::1", "fc00::1", "fd00::1", "fe80::1" → true
  IPv6 パブリック: "2001:4860:4860::8888" → false
  malformed → true (fail-safe)
```

---

### Step 4: 統合テスト作成 (13.2)

**ディレクトリ:** `tests/integration/`

統合テストでは Next.js の `Request` オブジェクトを直接生成して route handler を呼び出す。
Supabase Admin クライアントは `require.cache` への事前注入でモック化する。

#### 共通ヘルパー: `tests/integration/helpers/supabase-mock.ts`

Supabase チェーン呼び出し (`from().select().eq().single()` 等) を返す mock ファクトリを作成。
各テストで返り値をカスタマイズできる設計。

#### `tests/integration/keys.integration.test.ts`

Supabase mock と `authenticateApiKey` stub を `require.cache` に注入した後、
`POST` handler を `require()` して呼び出す。

```
POST /api/v1/keys — permissions バリデーション
  ["invalid_perm"] → 400 bad_request
  ["superuser"] → 400 bad_request
  ["read"] → Supabase insert が呼ばれる (201)
  ["read", "write"] → 通過

POST /api/v1/keys — name バリデーション
  name 省略 → 400
  name: "" → 400

POST /api/v1/keys — expires_at バリデーション（統合確認）
  "invalid_date" → 400
  "2020-01-01" → 400 (過去日)
  省略 → 通過
```

#### `tests/integration/knowledge.integration.test.ts`

```
POST /api/v1/knowledge — full_content サイズ
  500,001 文字 → 400
  500,000 文字 → Supabase insert が呼ばれる (201)

POST /api/v1/knowledge — content_type
  "invalid" → 400
  "prompt" → 通過
```

#### `tests/integration/webhooks.integration.test.ts`

SSRF チェックは `isPublicUrl()` を呼ぶため、DNS 解決が発生する。
テスト環境では `"https://127.0.0.1/hook"` のような IP リテラルを使い DNS 不要でテスト。

```
POST /api/v1/webhooks — SSRF 保護
  "https://127.0.0.1/hook" → 400
  "https://192.168.1.1/hook" → 400
  events: ["invalid.event"] → 400
  events: [] → 400
  events: ["purchase.completed"] + valid public URL → 通過 (201)
```

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
|---------|------|------|
| `src/lib/api/validation.ts` | 新規 | `validateExpiresAt()` |
| `src/app/api/v1/keys/route.ts` | 修正 | inline → `validateExpiresAt()` 呼び出し |
| `tsconfig.test.json` | 新規 | CJS 対応 tsconfig |
| `package.json` | 修正 | `test:unit` / `test:integration` スクリプト追加 |
| `tests/unit/api/auth.test.ts` | 新規 | generateApiKey ユニットテスト |
| `tests/unit/api/permissions.test.ts` | 新規 | ALLOWED_PERMISSIONS テスト |
| `tests/unit/api/validation.test.ts` | 新規 | validateExpiresAt テスト |
| `tests/unit/knowledge/metadata.test.ts` | 新規 | sanitizeMetadata テスト |
| `tests/unit/knowledge/requestContent.test.ts` | 新規 | requestContent テスト |
| `tests/unit/webhooks/ssrf.test.ts` | 新規 | isPrivateIp テスト |
| `tests/integration/helpers/supabase-mock.ts` | 新規 | Supabase モックヘルパー |
| `tests/integration/keys.integration.test.ts` | 新規 | keys route 統合テスト |
| `tests/integration/knowledge.integration.test.ts` | 新規 | knowledge route 統合テスト |
| `tests/integration/webhooks.integration.test.ts` | 新規 | webhooks route 統合テスト |

---

## 検証手順

```bash
# ユニットテスト（CI / サーバーなしで実行可）
npm run test:unit

# 統合テスト（Supabase モック経由で実行）
npm run test:integration

# 既存 E2E は変更なし
npm run test:e2e:fake-tx
npm run test:e2e:cli-flow
```

**CI 条件**: `npm run test:unit` は外部依存ゼロ（Supabase / RPC 接続不要）で全グリーンになること。
