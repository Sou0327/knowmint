# Plan: Phase 5.4 MCP Server 実装

## Context

KnowMint のコアバリューは「人間の暗黙知をAIエージェントが自律購入できる場」。
OpenClaw などのエージェントが KnowMint を「ツール」として使うためには MCP Server が必須。
現在 MCP 実装はゼロ。REST API と CLI は完成済みのため、それらを HTTP 経由で呼び出す
stdio transport の MCP Server を `mcp/` ディレクトリに新設する。

---

## ディレクトリ構造

```
mcp/
├── package.json          # @modelcontextprotocol/sdk + zod
├── tsconfig.json         # NodeNext module resolution
└── src/
    ├── index.ts          # エントリポイント: McpServer + StdioTransport
    ├── api.ts            # HTTP クライアント (cli/bin/km.mjs のパターンを TypeScript 化)
    └── tools.ts          # 5 ツールの定義と実装
```

加えて、ルート `package.json` に `km-mcp` スクリプトを追記。
MCP 設定例ファイルは `mcp/` 内に README.md として記述。

---

## 実装詳細

### mcp/package.json

```json
{
  "name": "@knowledge-market/mcp-server",
  "version": "0.1.0",
  "type": "module",
  "bin": { "km-mcp": "./dist/index.js" },
  "scripts": {
    "dev":   "node --experimental-strip-types src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0"
  },
  "engines": { "node": ">=22.6.0" }
}
```

### mcp/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"]
}
```

### mcp/src/api.ts

`cli/bin/km.mjs` の `loadConfig()` / `apiJson()` / `parseApiResponse()` を
TypeScript で型付けしたもの。新規ロジックは書かない。

- `loadConfig()`: `KM_API_KEY` env → `~/.km/config.json` の順で読み込む。どちらも無ければ exit(1)
- `apiRequest<T>()`: 汎用 fetch ラッパー。`{ success: true, data: T }` を返す
- **注意**: `searchKnowledge()` のみ `apiPaginated` 形式 `{ success: true, data: T[], pagination: {...} }` なので、
  別途 `apiRequestPaginated()` を用意するか、raw body を返す分岐で対応する
- `createAndPublishKnowledge()`: POST /knowledge (draft作成) → POST /knowledge/{id}/publish の2ステップを1関数でラップ

### mcp/src/tools.ts

`McpServer` に `server.tool()` で 5 ツールを登録する。入力スキーマは Zod。

| ツール名 | 説明 | 必須パラメータ | API 呼び出し先 |
|----------|------|----------------|----------------|
| `km_search` | ナレッジ検索 | `query: string` | `GET /api/v1/knowledge` |
| `km_get_detail` | 詳細+プレビュー取得 | `knowledge_id: string` | `GET /api/v1/knowledge/{id}` |
| `km_purchase` | 購入記録 (tx_hash送信後) | `knowledge_id, tx_hash` | `POST /api/v1/knowledge/{id}/purchase` |
| `km_get_content` | 購入済みコンテンツ取得 | `knowledge_id: string` | `GET /api/v1/knowledge/{id}/content` |
| `km_publish` | 下書き作成+公開 (1ステップ) | `title, description, content_type, content` | POST /knowledge → POST /knowledge/{id}/publish |

**エラーハンドリング**: 全ツールで try/catch し、`{ content: [{type:"text", text: "..."}], isError: true }` を返す。
throw はしない。

**重要**: `console.log` は使用禁止。全ての診断出力は `process.stderr.write()` 経由。
stdout は MCP wire protocol 専用。

### mcp/src/index.ts

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./api.js";
import { registerTools } from "./tools.js";

async function main() {
  const config = await loadConfig();   // 失敗時は stderr + exit(1)
  const server = new McpServer({ name: "knowledge-market", version: "0.1.0" });
  registerTools(server, config);
  await server.connect(new StdioServerTransport());
  process.stderr.write(`[km-mcp] running (${config.baseUrl})\n`);
}
main().catch(e => { process.stderr.write(`[km-mcp] fatal: ${e.message}\n`); process.exit(1); });
```

### ルート package.json への追記

```json
"km-mcp": "node --experimental-strip-types mcp/src/index.ts"
```

---

## 設定例 (README.md に記載)

**Claude Code** (`~/.claude/mcp.json`):
```json
{
  "mcpServers": {
    "knowledge-market": {
      "command": "node",
      "args": ["--experimental-strip-types", "/path/to/knowledge_market/mcp/src/index.ts"],
      "env": { "KM_API_KEY": "km_...", "KM_BASE_URL": "https://your-domain.com" }
    }
  }
}
```

`km login` 済みであれば env 指定不要 (`~/.km/config.json` を自動読み込み)。

---

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `mcp/package.json` | 新規作成 |
| `mcp/tsconfig.json` | 新規作成 |
| `mcp/src/index.ts` | 新規作成 |
| `mcp/src/api.ts` | 新規作成 |
| `mcp/src/tools.ts` | 新規作成 |
| `mcp/README.md` | 新規作成 (設定例) |
| `package.json` | `km-mcp` スクリプト追記 |
| `Plans.md` | Phase 5.4 チェックボックスを更新 |

---

## 検証手順

1. **起動確認**:
   ```bash
   KM_API_KEY=km_xxx KM_BASE_URL=http://localhost:3000 npm run km-mcp
   # stderr に "[km-mcp] running (http://localhost:3000)" が出ること
   # stdout は無音であること (MCP wire protocol 専用)
   ```

2. **MCP Inspector でツール動作確認**:
   ```bash
   npx @modelcontextprotocol/inspector node --experimental-strip-types mcp/src/index.ts
   ```
   - `km_search`: `query: "kubernetes"` でアイテムリストが返ること
   - `km_get_detail`: 有効な ID で `preview_content` が含まれること
   - `km_get_content`: 未購入アイテムで `isError: true` が返ること
   - `km_publish`: `price_sol/price_usdc` 両方未指定で `isError: true` が返ること
   - `km_purchase`: 偽の `tx_hash` で `isError: true` が返ること (オンチェーン検証失敗)

3. **Claude Code 統合確認**:
   - `~/.claude/mcp.json` に追記後、Claude Code を再起動
   - `km_search` ツールが利用可能として表示されること

---

## 留意事項

- `searchKnowledge` の `apiPaginated` レスポンスは `{data:[...], pagination:{...}}` 形式。
  他のエンドポイントと異なり `json.data` の中がさらにラップされていないため、
  `apiRequest` の型パラメータを正しく設定すること
- `km_publish` で下書き作成成功・公開失敗の場合、下書きが孤立する。
  DELETE エンドポイントが存在しないため、この状態は許容し、ツールのエラー返却で対応
- Node 22 の `--experimental-strip-types` では `import type` の使用が必須
