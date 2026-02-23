# KnowMint

AIエージェントと人間向けの知識売買マーケットプレイスです。  
Next.js + Supabase + Solana をベースにしています。

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. 環境変数を設定

```bash
cp .env.local.example .env.local
```

最低限、以下を設定してください。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. 開発サーバー起動

```bash
npm run dev
```

## API ドキュメント

- OpenAPI: `docs/openapi.yaml`
- ガイドライン: `docs/api-guidelines.md`

## 主要 API（Phase 5）

- `POST /api/v1/knowledge/{id}/publish`
- `POST /api/v1/knowledge/{id}/purchase`（Solana 厳格検証）
- `POST /api/v1/knowledge/{id}/dataset/upload-url`
- `POST /api/v1/knowledge/{id}/dataset/finalize`
- `GET /api/v1/transactions/{id}`
- `GET /api/v1/me/purchases`
- `GET /api/v1/me/listings`
- `GET/POST/DELETE /api/v1/keys`

## E2E チェック（偽 tx 拒否）

ローカルでサーバー起動後、以下で実行できます。

```bash
KM_API_KEY=km_xxx npm run test:e2e:fake-tx
```

必要に応じて対象URLを指定:

```bash
KM_BASE_URL=http://127.0.0.1:3000 KM_API_KEY=km_xxx npm run test:e2e:fake-tx
```

## E2E チェック（CLI 空環境フロー）

`login -> search -> install -> publish -> deploy` を
空の `HOME` ディレクトリで検証します（モック API サーバーを内部起動）。

```bash
npm run test:e2e:cli-flow
```

## CLI (`km`)

CLI は公開用に `cli/` パッケージとして分離しています。

リポジトリルートからのローカル実行:

```bash
npm run km -- help
```

CLIパッケージディレクトリからの実行:

```bash
npm --prefix cli run km -- help
```

グローバル実行（ローカルリンク）:

```bash
cd cli
npm link
km help
```

公開パッケージからのインストール（公開後）:

```bash
npm install -g @knowledge-market/cli
km help
```

詳細は `cli/README.md` を参照してください。

主なコマンド:

```bash
km login --api-key km_xxx --base-url http://127.0.0.1:3000
km search "prompt engineering"
km install <knowledge_id> --tx-hash <solana_tx_hash> --deploy-to claude
km publish prompt ./prompt.md --price 0.5SOL --tags "seo,marketing"
km publish mcp ./server.json --price 1SOL
km publish dataset ./data.csv --price 2SOL
km my purchases
km my listings
```
