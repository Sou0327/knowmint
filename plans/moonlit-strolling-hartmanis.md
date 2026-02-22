# Cloudflare Pages 移行プラン

## Context

グローバル配信重視 + 商用利用のため Vercel → Cloudflare Pages へ全面移行する。
Vercel Hobby は商用利用禁止。Cloudflare Pages は商用無料かつエッジロケーション豊富。

**調査結果の重要な発見:**
- `nodejs_compat_v2` フラグで `crypto` / `Buffer` はすべてそのまま動く (createCipheriv, createHmac, timingSafeEqual, randomBytes, Buffer — すべて対応済み)
- `@cloudflare/next-on-pages` は非推奨 → **OpenNext Cloudflare adapter** (`@opennextjs/cloudflare`) を使う (Next.js 16 対応)
- Vercel 固有の npm パッケージ依存ゼロ (コード改修不要)
- Cron は `pg_cron` SQL で Supabase 側に移行 → `vercel.json` が不要になる

---

## 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---|---|---|
| `vercel.json` | **削除** | Cron を pg_cron に移行するため不要 |
| `wrangler.toml` | **新規作成** | Cloudflare Workers / Pages 設定 |
| `open-next.config.ts` | **新規作成** | OpenNext Cloudflare adapter 設定 |
| `package.json` | **編集** | devDep 追加・デプロイスクリプト追加 |
| `supabase/migrations/20260223000023_pg_cron_cleanup_pending_tx.sql` | **新規作成** | pg_cron で30分ごとに pending TX を failed に更新 |
| `src/app/api/cron/cleanup-pending-tx/route.ts` | **編集** | コメントから Vercel Cron 記述を除去 (手動トリガー用として残す) |

---

## 実装詳細

### 1. `vercel.json` 削除

不要のため削除する (git rm)。

---

### 2. `wrangler.toml` 新規作成

```toml
name = "knowledge-market"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat_v2"]
pages_build_output_dir = ".open-next/assets"

# 環境変数は Cloudflare Dashboard の Pages → Settings → Environment variables に設定
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# NEXT_PUBLIC_SOLANA_RPC_URL, NEXT_PUBLIC_SOLANA_NETWORK, WEBHOOK_SIGNING_KEY,
# UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ALLOWED_ORIGIN 等
```

`nodejs_compat_v2` により既存コードの crypto/Buffer は **無改修で動作**。

---

### 3. `open-next.config.ts` 新規作成

```ts
import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    override: {},
  },
};

export default config;
```

---

### 4. `package.json` 編集

devDependencies に追加:
```json
"@opennextjs/cloudflare": "latest",
"wrangler": "^3"
```

scripts に追加:
```json
"build:cf":   "opennextjs-cloudflare build",
"deploy:cf":  "opennextjs-cloudflare deploy",
"preview:cf": "opennextjs-cloudflare preview"
```

---

### 5. `pg_cron` マイグレーション (新規)

`supabase/migrations/20260223000023_pg_cron_cleanup_pending_tx.sql`:

```sql
-- pg_cron 拡張は Supabase Dashboard → Database → Extensions から有効化必須
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 30分ごとに pending → failed に更新 (Vercel Cron の代替)
SELECT cron.schedule(
  'cleanup-pending-tx',
  '*/30 * * * *',
  $$
    UPDATE public.transactions
    SET    status     = 'failed',
           updated_at = NOW()
    WHERE  status     = 'pending'
      AND  created_at < NOW() - INTERVAL '30 minutes';
  $$
);
```

HTTP エンドポイント (`/api/cron/cleanup-pending-tx`) は手動デバッグ用として残す。

---

### 6. cron route コメント修正

`src/app/api/cron/cleanup-pending-tx/route.ts` の JSDoc を更新:

```typescript
/**
 * GET /api/cron/cleanup-pending-tx
 * 手動トリガー用エンドポイント。
 * スケジュール実行は Supabase pg_cron が担う (vercel.json 不要)。
 * ...
 */
```

---

## Codex レビュー対象

- `wrangler.toml`
- `open-next.config.ts`
- `supabase/migrations/20260223000023_pg_cron_cleanup_pending_tx.sql`

---

## 検証手順

```bash
# 1. ビルド確認
npm run build:cf        # → .open-next/ が生成されること

# 2. ローカルプレビュー
npm run preview:cf      # → http://localhost:8788 でアクセス確認

# 3. vercel.json がなくなっていること
ls vercel.json          # → No such file

# 4. Cloudflare Pages へデプロイ
npm run deploy:cf
```

**Supabase 側:**
1. Dashboard → Database → Extensions → `pg_cron` を有効化
2. migration 適用: `supabase db push --linked`
3. `SELECT * FROM cron.job;` でジョブ登録確認
4. `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;` で実行ログ確認

---

## 外部操作チェックリスト (実装後)

```
[ ] Cloudflare Dashboard → Pages → Create project → Connect GitHub repo
[ ] Build command: npm run build:cf  / Output: .open-next/assets に設定
[ ] Cloudflare Pages → Environment variables に本番 env 設定
[ ] Supabase Dashboard → Database → Extensions → pg_cron 有効化
[ ] supabase db push --linked (migration 適用)
[ ] npm run preview:cf でローカル動作確認
[ ] npm run deploy:cf でデプロイ
```
