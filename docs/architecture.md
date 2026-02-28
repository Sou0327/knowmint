# KnowMint アーキテクチャ詳細

## ウォレット統合

- **Solana**: `contexts/WalletContext.tsx` → `@solana/wallet-adapter-react` (Phantom, Solflare)
- **EVM**: `contexts/EVMWalletContext.tsx` → `wagmi` v3 + `viem` (Base, Ethereum / MetaMask, Coinbase Wallet)
- **チェーン選択**: `contexts/ChainContext.tsx` で管理
- **EVM 購入 API**: 未対応 (UI のみ)。`chain !== "solana"` → BAD_REQUEST

## CLI ツール (`cli/bin/km.mjs`)

スタンドアロン Node.js CLI。設定は `~/.km/config.json` に保存。

- `--deploy-to claude,opencode` で購入ナレッジを自動デプロイ
- `km publish` の型は `prompt` / `mcp` / `dataset` のみ (`tool_def` は CLI 非対応)

## MCP サーバー (`mcp/src/`)

`@knowmint/mcp-server` — AI エージェントが KnowMint を直接操作するための MCP サーバー。

- **ツール**: `km_search` / `km_get_detail` / `km_purchase` / `km_get_content` / `km_get_version_history` / `km_publish`
- **設定**: `~/.claude/mcp.json` に `KM_API_KEY` + `KM_BASE_URL` を記述
- **x402 自律購入フロー**: `km_get_content()` → HTTP 402 → 送金 → `payment_proof` で再実行
- **Node.js 22.6+** 必須 (`--experimental-strip-types` 使用)
- **依存インストール**: `cd mcp && npm install`

### Claude Code 設定例 (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "knowmint": {
      "command": "npx",
      "args": ["--yes", "--package", "@knowmint/mcp-server@0.1.2", "mcp-server"],
      "env": { "KM_API_KEY": "km_xxx", "KM_BASE_URL": "https://knowmint.shop" }
    }
  }
}
```

## Maestro E2E テスト (`maestro/flows/`)

UI の E2E テストを Maestro で管理。18フロー整備済み。

- **実行**: `maestro/run-tests.sh` (順次) または `npm run test:e2e:ui`
- **フロー**: `maestro/flows/01-18.yaml`
- **注意**: 日本語テキストへの `extendedWaitUntil` は不安定 → `scrollUntilVisible` + timeout で代替
- **注意**: 同名要素が複数ある場合は一意なテキストで `tapOn`
- 未カバー: `/library/{id}` のみ (実購入必要のためスキップ)

## Cloudflare Workers デプロイ

- `npm run build:cf` → opennextjs-cloudflare build + `@vercel/og` WASM 除去
- `npm run deploy:cf` → wrangler deploy
- CI/CD: `main` push → 本番, PR → プレビュー (`.github/workflows/deploy.yml`)
- Worker 名は `knowledgemarket` (ハイフン不可・自動変換)
