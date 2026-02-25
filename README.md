# KnowMint

人間の暗黙知・体験知を AIエージェントに販売できる知識マーケットプレイス。

**コアバリュー:**
- **人間→AI 知識供給**: AIが自力で獲得できない体験知・暗黙知・感性を、AIエージェントが自律購入
- **人間の新収益源**: 自分の経験・知識を出品 → AIエージェント (Claude Code 等) が発見・購入
- **ノンカストディアル決済**: 買い手→売り手 P2P 直接送金 (秘密鍵は運営非保有)

**アクセス方法:** Web UI / CLI (`km`) / REST API + MCP サーバー

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19, TypeScript, Tailwind CSS v4 |
| Backend/DB | Supabase (PostgreSQL, Auth, Storage, RLS) |
| 決済 | Solana (Anchor 0.32.1 / 95:5 自動分配) + EVM (wagmi v3 / viem、UI のみ / 購入 API は Solana 限定) |
| レート制限 | Upstash Redis |
| MCP | `@knowmint/mcp-server` (`@modelcontextprotocol/sdk`) |
| デプロイ | Cloudflare Workers (opennextjs-cloudflare) |
| テスト | Mocha/Chai (unit/integration) + Maestro (E2E UI) |

---

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
cd mcp && npm install && cd ..   # MCP サーバー依存 (km-mcp 使用時)
```

### 2. 環境変数を設定

```bash
cp .env.local.example .env.local
```

**必須:**

| 変数 | 説明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin クライアント用 (API routes) |

**オプション (本番推奨):**

| 変数 | 説明 |
|---|---|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC (未設定時は `NEXT_PUBLIC_SOLANA_NETWORK` に対応する default RPC。ネットワーク未指定時は devnet) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` (default) / `mainnet-beta` |
| `X402_NETWORK` | x402 決済ネットワーク CAIP-2 識別子 (例: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)。コンテンツ取得を使う場合は `X402_NETWORK` と `NEXT_PUBLIC_SOLANA_NETWORK` の両方が**必須**。未設定・不正値・不一致のいずれでも 500 エラー |
| `CRON_SECRET` | cron クリーンアップジョブ認証キー (**本番必須**。`/api/cron/cleanup-pending-tx` で使用。未設定時は 401 でジョブ失敗) |
| `UPSTASH_REDIS_REST_URL` | レート制限用 Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | レート制限用 Upstash Redis トークン |
| `WEBHOOK_SIGNING_KEY` | Webhook 署名検証キー (**本番必須**。未設定時は Webhook 配信不可) |

### 3. Supabase ローカル起動

```bash
npx supabase start
```

### 4. 開発サーバー起動

```bash
npm run dev   # http://localhost:3000
```

---

## 開発コマンド

```bash
npm run dev              # 開発サーバー
npm run build            # Next.js プロダクションビルド
npm run lint             # ESLint
npm run km -- <cmd>      # CLI ツール
npm run km-mcp           # MCP サーバー (stdio) ※ Node.js 22.6+ 必須・cd mcp && npm install が必要
npm run build:cf         # Cloudflare Workers ビルド
npm run deploy:cf        # Cloudflare Workers デプロイ
npm run preview:cf       # Cloudflare Workers プレビュー
```

---

## MCP サーバー

`@knowmint/mcp-server` を使うと、Claude Code 等の AI エージェントが KnowMint から直接ナレッジを検索・購入・取得できます。

### Claude Code への設定例

設定ファイル: `~/.claude/mcp.json`

```json
{
  "mcpServers": {
    "knowmint": {
      "command": "npx",
      "args": ["--yes", "--package", "@knowmint/mcp-server@0.1.2", "mcp-server"],
      "env": {
        "KM_API_KEY": "km_xxx",
        "KM_BASE_URL": "https://knowmint.shop"
      }
    }
  }
}
```

> **セキュリティ**: 設定ファイルを公開リポジトリや同期ディレクトリに置かないでください。キーは定期的にローテーションしてください。
> - 検索・詳細取得のみ (`km_search` / `km_get_detail` / `km_get_content`) → `read` 権限キーで十分
> - 購入・出品も使う (`km_purchase` / `km_publish`) → `write` 権限キーが必要

### 利用可能ツール

| ツール | 説明 |
|---|---|
| `km_search` | ナレッジを検索 |
| `km_get_detail` | ナレッジ詳細を取得 |
| `km_purchase` | ナレッジを購入 (Solana 送金) |
| `km_get_content` | 購入済みコンテンツを取得 (x402 ゲート) |
| `km_get_version_history` | バージョン履歴を取得 |
| `km_publish` | ナレッジを出品 |

### x402 自律購入フロー

```
km_get_content() → payment_required (HTTP 402) → 送金 → payment_proof で再実行 → コンテンツ取得
```

---

## AI エージェントプラグイン

KnowMint は MCP サーバーに加え、主要な AI エージェントフレームワーク向けのプラグインを提供しています。

### Coinbase AgentKit (`packages/agentkit-plugin/`)

AgentKit エージェントが KnowMint を「ウォレット付きツール」として使えるプラグイン。

- `ActionProvider<WalletProvider>` + `@CreateAction` で 5 アクション実装
- テスト: モック 50/50 PASS + ローカル実通信 7/7 PASS

```bash
cd packages/agentkit-plugin && npm install && npm run build
```

### ElizaOS (`packages/eliza-plugin/`)

ai16z Eliza フレームワーク向けプラグイン。

- **Actions**: `SEARCH_KNOWLEDGE` / `PURCHASE_KNOWLEDGE` / `GET_CONTENT`
- **Provider**: `trending-knowledge` (人気ナレッジ 5 件をコンテキスト注入)
- テスト: ユニット 53/53 PASS + ライブ API 統合 8/8 PASS

```bash
cd packages/eliza-plugin && npm install && npm run build
```

```typescript
import { knowmintPlugin } from "@knowmint/eliza-plugin";

// ElizaOS キャラクター設定に追加
const character = {
  plugins: [knowmintPlugin],
  settings: {
    KM_API_KEY: "km_xxx",
    KM_BASE_URL: "https://knowmint.shop", // optional
  },
};
```

---

## CLI (`km`)

スタンドアロン Node.js CLI。設定は `~/.km/config.json` に保存。

```bash
# ローカル実行
npm run km -- help

# グローバルリンク (開発用)
cd cli && npm link && km help

# 公開後のインストール
npm install -g @knowmint/cli
```

**主なコマンド:**

```bash
# セキュリティ: API キーは対話入力または環境変数で渡すことを推奨
km login --base-url https://knowmint.shop   # API キーを対話入力
km search "prompt engineering"
km install <knowledge_id> --tx-hash <solana_tx_hash> --deploy-to claude
km publish prompt ./prompt.md --price 0.5SOL --tags "seo,marketing"
km publish mcp ./server.json --price 1SOL
km publish dataset ./data.csv --price 2SOL
km my purchases
km my listings
```

`--deploy-to claude,opencode` で購入ナレッジを自動デプロイ。

詳細は `cli/README.md` を参照。

---

## Cloudflare Workers デプロイ

opennextjs-cloudflare を使って Next.js アプリを Cloudflare Workers にデプロイします。

```bash
npm run build:cf    # opennextjs-cloudflare build + @vercel/og WASM 除去
npm run deploy:cf   # wrangler deploy (本番)
npm run preview:cf  # プレビューデプロイ
```

**CI/CD** (`.github/workflows/deploy.yml`):
- `main` への push → 本番 Worker に自動デプロイ
- PR 作成 → プレビュー Worker に自動デプロイ
- PR クローズ → プレビュー Worker 削除

---

## テスト

```bash
# Unit テスト (111件)
npm run test:unit

# Staging 統合テスト (supabase start 必要)
npm run test:staging

# E2E テスト
npm run test:e2e:fake-tx        # 偽トランザクション拒否
npm run test:e2e:cli-flow       # CLI フロー (login/search/install/publish/deploy)
npm run test:e2e:x402-flow      # HTTP 402 ペイメントゲート
npm run test:e2e:devnet         # devnet SOL 送金→購入→コンテンツ取得

# Maestro UI E2E (18 フロー)
npm run test:e2e:ui
```

**devnet E2E 必須環境変数:**

```bash
export KM_BASE_URL=http://127.0.0.1:3000
export NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
export TEST_API_KEY_BUYER=km_xxx
export KM_TEST_KNOWLEDGE_ID=<item-uuid>
export TEST_BUYER_KEYPAIR_PATH=./devnet-buyer-keypair.json
export TEST_SELLER_WALLET=<seller-pubkey>
npm run test:e2e:devnet
```

---

## API エンドポイント

ほとんどのエンドポイントは `withApiAuth` HOC で保護されています (API キー認証 + レート制限)。
`/api/v1/keys` は例外で、独自の認証ロジックを使用します。

詳細: `docs/openapi.yaml` / `docs/api-guidelines.md`

### Knowledge

| メソッド + パス | 説明 |
|---|---|
| `GET /api/v1/knowledge` | ナレッジ一覧 |
| `POST /api/v1/knowledge` | ナレッジ作成 |
| `POST /api/v1/knowledge/batch` | ナレッジ一括取得 (`{ "ids": ["<uuid>", ...] }`) |
| `GET /api/v1/knowledge/{id}` | ナレッジ詳細 |
| `PATCH /api/v1/knowledge/{id}` | ナレッジ更新 |
| `POST /api/v1/knowledge/{id}/publish` | ナレッジ公開 |
| `POST /api/v1/knowledge/{id}/purchase` | ナレッジ購入 (Solana TX 検証) |
| `GET /api/v1/knowledge/{id}/content` | 購入済みコンテンツ取得 (x402 ゲート) |
| `GET /api/v1/knowledge/{id}/preview` | プレビュー取得 |
| `POST /api/v1/knowledge/{id}/feedback` | フィードバック送信 |
| `GET /api/v1/knowledge/{id}/versions` | バージョン一覧 |
| `POST /api/v1/knowledge/{id}/dataset/upload-url` | Supabase Storage 署名付きアップロード URL 発行 |
| `POST /api/v1/knowledge/{id}/dataset/finalize` | データセット確定 |

### ユーザー

| メソッド + パス | 説明 |
|---|---|
| `GET /api/v1/transactions/{id}` | トランザクション詳細 |
| `GET /api/v1/me/purchases` | 購入履歴 |
| `GET /api/v1/me/listings` | 出品一覧 |
| `POST /api/v1/me/wallet/challenge` | SIWS チャレンジ発行 |
| `POST /api/v1/me/wallet/verify` | 署名検証 (ウォレット認証) |

### その他

| メソッド + パス | 説明 |
|---|---|
| `GET /api/v1/categories` | カテゴリ一覧 |
| `GET /api/v1/favorites` | お気に入り一覧 |
| `POST /api/v1/favorites` | お気に入り追加 |
| `DELETE /api/v1/favorites` | お気に入り削除 |
| `GET /api/v1/keys` | API キー一覧 |
| `POST /api/v1/keys` | API キー作成 |
| `DELETE /api/v1/keys` | API キー削除 |
| `GET /api/v1/webhooks` | Webhook 一覧 |
| `POST /api/v1/webhooks` | Webhook 作成 |
| `DELETE /api/v1/webhooks` | Webhook 削除 |
| `POST /api/v1/webhooks/{id}/regenerate` | Webhook シークレット再生成 |

---

## コンテンツタイプ

`prompt` | `tool_def` | `dataset` | `api` | `general`
