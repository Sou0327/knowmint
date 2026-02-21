# Knowledge Market MCP Server

stdio transport の MCP Server。Claude Code / OpenCode などのエージェントが
Knowledge Market を「ツール」として利用できる。

## 提供ツール

| ツール | 説明 |
|--------|------|
| `km_search` | ナレッジ検索 |
| `km_get_detail` | ナレッジ詳細 + プレビュー取得 |
| `km_purchase` | 購入記録 (tx_hash 送信後) |
| `km_get_content` | 購入済みコンテンツ取得 |
| `km_publish` | ナレッジ出品 (下書き作成 → 公開) |

## セットアップ

### 前提条件

- Node.js 22.6.0 以上 (`--experimental-strip-types` 対応)
- Knowledge Market の API キー (`km login` で取得、または Web UI から発行)

### 認証

優先順位:
1. 環境変数 `KM_API_KEY`
2. `~/.km/config.json` (`km login` で保存)

`km login` 済みの場合、env 指定は不要。

## MCP 設定例

### Claude Code (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "knowledge-market": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "/path/to/knowledge_market/mcp/src/index.ts"
      ],
      "env": {
        "KM_API_KEY": "km_xxxxxxxxxxxx",
        "KM_BASE_URL": "https://your-domain.com"
      }
    }
  }
}
```

`km login` 済みの場合 (env 省略可):

```json
{
  "mcpServers": {
    "knowledge-market": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "/path/to/knowledge_market/mcp/src/index.ts"
      ]
    }
  }
}
```

### ビルド済みバイナリを使う場合

```bash
cd mcp && npm install && npm run build
```

```json
{
  "mcpServers": {
    "knowledge-market": {
      "command": "node",
      "args": ["/path/to/knowledge_market/mcp/dist/index.js"],
      "env": { "KM_API_KEY": "km_xxx" }
    }
  }
}
```

### OpenCode (`.opencode/config.json`)

```json
{
  "mcp": {
    "servers": {
      "knowledge-market": {
        "command": "node",
        "args": [
          "--experimental-strip-types",
          "/path/to/knowledge_market/mcp/src/index.ts"
        ],
        "env": { "KM_API_KEY": "km_xxx", "KM_BASE_URL": "https://your-domain.com" }
      }
    }
  }
}
```

### OpenClaw + Phantom MCP との組み合わせ

```json
{
  "mcpServers": {
    "knowledge-market": {
      "command": "node",
      "args": ["--experimental-strip-types", "/path/to/mcp/src/index.ts"],
      "env": { "KM_API_KEY": "km_xxx", "KM_BASE_URL": "https://your-domain.com" }
    },
    "phantom": {
      "command": "npx",
      "args": ["-y", "@phantom/mcp-server"]
    }
  }
}
```

エージェントは Phantom MCP で SOL 送金 → `km_purchase` で tx_hash 提出、という
自律購入フローを実行できる。

## 動作確認

```bash
# 起動確認 (stderr に running が出れば OK)
KM_API_KEY=km_xxx KM_BASE_URL=http://localhost:3000 npm run km-mcp

# MCP Inspector で対話確認
npx @modelcontextprotocol/inspector node --experimental-strip-types mcp/src/index.ts
```

## 開発

```bash
# 依存インストール
cd mcp && npm install

# 型チェック
npm run build

# 開発実行 (型ストリップ)
npm run dev
```
