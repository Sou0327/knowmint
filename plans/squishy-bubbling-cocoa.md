# Phase 23: MCP npm パッケージ公開 (`npx km-mcp`)

## Context

MCP サーバー (`mcp/` ディレクトリ) は実装完了済みだが、npm パッケージとして公開するための必須メタデータ (`description`, `keywords`, `license`, `files`, `publishConfig` 等) がまだ設定されていない。また `npx` での起動を想定した README ドキュメントが未整備。これを整備して `npx @knowledge-market/mcp-server` 一発で Claude/Cursor/OpenCode に接続できる状態にする。

## 現状の確認

- `mcp/src/index.ts` 1行目: `#!/usr/bin/env node` → **shebang 済み**
- `mcp/tsconfig.json`: `allowImportingTsExtensions: true` → `declaration: true` 追加禁止 (TS5073)。CLI ツールなので型宣言ファイルは不要。**tsconfig.json 変更不要**
- `mcp/src/api.ts` 83行目: `fatal("No API key configured. Set KM_API_KEY env var, or run \`km login\`.")` → 要件と異なる。変更が必要
- GitHub URL: `https://github.com/Sou0327/knowledge_market.git`

## 実装計画

### 23.1 `mcp/package.json` — メタデータ追加

以下フィールドを既存の内容に追加:

```json
{
  "description": "MCP server for Knowledge Market — lets AI agents discover and purchase human tacit knowledge",
  "keywords": ["mcp", "model-context-protocol", "knowledge-market", "ai-agent", "solana", "claude", "opencode", "cursor"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Sou0327/knowledge_market.git",
    "directory": "mcp"
  },
  "files": ["dist/", "README.md"],
  "exports": { ".": "./dist/index.js" },
  "publishConfig": { "access": "public" }
}
```

### 23.2 `mcp/.npmignore` — 新規作成

```
src/
tsconfig.json
plans/
node_modules/
*.tsbuildinfo
.DS_Store
```

(`files` フィールドと二重防御として作成)

### 23.3 `mcp/src/api.ts` — エラーメッセージ修正

**対象**: `src/api.ts:83`

```typescript
// Before
fatal("No API key configured. Set KM_API_KEY env var, or run `km login`.");

// After
fatal("KM_API_KEY is required. Get your key at https://knowledge-market.app/settings/api");
```

`fatal()` が `[km-mcp]` プレフィックスを自動付与するため、最終出力:
```
[km-mcp] KM_API_KEY is required. Get your key at https://knowledge-market.app/settings/api
```

### 23.4 `mcp/README.md` — npx 設定例を先頭セクションに追記

既存の「MCP 設定例」セクションの**前**に以下を挿入:

```markdown
## クイックスタート (npx)

インストール不要。以下の設定を追加するだけで即使用できます。

### Claude Code (`~/.claude/mcp.json`)
\`\`\`json
{
  "mcpServers": {
    "knowledge-market": {
      "command": "npx",
      "args": ["-y", "@knowledge-market/mcp-server"],
      "env": {
        "KM_API_KEY": "km_xxx",
        "KM_BASE_URL": "https://knowledge-market.app"
      }
    }
  }
}
\`\`\`

### Cursor (`~/.cursor/mcp.json`)
\`\`\`json
{ (同上) }
\`\`\`

### OpenCode (`.opencode/config.json`)
\`\`\`json
{
  "mcp": {
    "servers": {
      "knowledge-market": {
        "command": "npx",
        "args": ["-y", "@knowledge-market/mcp-server"],
        "env": { "KM_API_KEY": "km_xxx", "KM_BASE_URL": "https://knowledge-market.app" }
      }
    }
  }
}
\`\`\`
```

### 23.5 ビルド確認 (手動確認)

```bash
cd mcp && npm run build
node dist/index.js   # エラーメッセージ出力を確認して終了
```

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `mcp/package.json` | Edit — メタデータフィールド追加 |
| `mcp/.npmignore` | Write — 新規作成 |
| `mcp/src/api.ts` | Edit — 83行目 エラーメッセージ変更 |
| `mcp/README.md` | Edit — npx 設定例セクション追記 |
| `mcp/tsconfig.json` | **変更なし** |

## 手動操作 (コード実装外)

```bash
# npm publish (23.4)
npm login
cd mcp && npm run build
npm pack --dry-run     # dist/ と README.md のみ含まれることを確認
npm publish --access public
npx @knowledge-market/mcp-server  # 起動確認
```

## 検証

1. `cd mcp && npm run build` でビルドエラーなし
2. `KM_API_KEY` 未設定で `node dist/index.js` を実行 → `[km-mcp] KM_API_KEY is required. Get your key at https://knowledge-market.app/settings/api` が stderr に出力される
3. `npm pack --dry-run` で `dist/*.js`, `README.md` のみ含まれることを確認 (`src/` が除外されている)
