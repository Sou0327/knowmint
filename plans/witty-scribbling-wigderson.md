# Phase 29: アプリリネーム — Knowledge Market → KnowMint

## Context

ブランド変更。`Knowledge Market` / `knowledge-market` / `knowledgemarket` / `ナレッジマーケット` を
`KnowMint` / `knowmint` に統一する。

**変換ルール**:
| Before | After |
|--------|-------|
| `Knowledge Market` (表示名) | `KnowMint` |
| `knowledge-market` (パッケージ名) | `knowmint` |
| `knowledgemarket` (CF Worker名等) | `knowmint` |
| `@knowledge-market/xxx` | `@knowmint/xxx` |
| `@knowledgemarket/xxx` | `@knowmint/xxx` |

**変更しない**:
- `knowledge_market` (Solana プログラム名、オンチェーン済み)
- `km` (CLI コマンド名 — KnowMint の略として継続)
- コード識別子・変数名・ファイルパス (純粋な表示文字列のみ変更)

---

## 変更ファイル一覧

### 29.1 UI・メタデータ (src/)

**`src/app/layout.tsx`** (L22, L26)
- `"Knowledge Market - 知識売買マーケットプレイス"` → `"KnowMint - 知識売買マーケットプレイス"`
- `"Knowledge Market - Knowledge Marketplace"` → `"KnowMint - Knowledge Marketplace"`

**`src/components/layout/Header.tsx`** (L44)
- `Knowledge Market` → `KnowMint`

**`src/components/layout/Footer.tsx`** (L12, L81)
- 両箇所の `Knowledge Market` → `KnowMint`

**`src/components/dashboard/ApiKeyManager.tsx`** (L321)
- `Knowledge Market API` → `KnowMint API`

**`src/lib/siws/message.ts`** (L27)
- `"Knowledge Market wants you to prove ownership..."` → `"KnowMint wants you to prove ownership..."`

**`src/lib/evm/config.ts`** (L9)
- `appName: "Knowledge Market"` → `appName: "KnowMint"`

**`src/lib/i18n/jaToEn.ts`** (複数行)
- L25: `"Knowledge Market アカウントを作成"` → `"KnowMint アカウントを作成"`
- L37: `"Knowledge Market にログイン"` → `"KnowMint にログイン"`
- L186: `"Knowledge Market API にプログラムからアクセス..."` → `"KnowMint API にプログラムからアクセス..."`
- L187: `"...Knowledge Market API programmatically."` → `"...KnowMint API programmatically."`
- L292: `"Knowledge Market - 知識売買マーケットプレイス"` → `"KnowMint - 知識売買マーケットプレイス"`
- L293: `"Knowledge Market - Knowledge Marketplace"` → `"KnowMint - Knowledge Marketplace"`

**`src/app/(main)/page.tsx`** (L30)
- `Knowledge Market` → `KnowMint`

### 29.2 設定ファイル

**`package.json`** (L2)
- `"name": "knowledge-market"` → `"name": "knowmint"`

**`wrangler.toml`** (L1)
- `name = "knowledgemarket"` → `name = "knowmint"`

**`mcp/package.json`** (L2, L4, L8)
- `"name": "@knowledgemarket/mcp-server"` → `"name": "@knowmint/mcp-server"`
- `"description": "MCP server for Knowledge Market — ..."` → `"MCP server for KnowMint — ..."`
- keywords: `"knowledge-market"` → `"knowmint"`

**`cli/package.json`** (L2, L4, L21)
- `"name": "@knowledge-market/cli"` → `"name": "@knowmint/cli"`
- `"description": "Knowledge Market CLI"` → `"KnowMint CLI"`
- keywords: `"knowledge-market"` → `"knowmint"`

### 29.3 MCP・SDK ソース

**`mcp/src/index.ts`** (L11)
- `name: "knowledge-market"` → `name: "knowmint"`

**`sdk/src/client.ts`** — コメント中の `Knowledge Market` → `KnowMint`

### 29.4 ドキュメント

**`README.md`** — タイトル・説明の `Knowledge Market` → `KnowMint`
**`mcp/README.md`** — サービス名を `KnowMint` に更新
**`cli/README.md`** — サービス名を `KnowMint` に更新

### 29.5 プロジェクトファイル

**`Plans.md`** (L1) — `# Knowledge Market - 開発計画` → `# KnowMint - 開発計画`
**`CLAUDE.md`** (L7) — Project Overview の `Knowledge Market` → `KnowMint`
**`memory/MEMORY.md`** — セッション間メモリのサービス名を `KnowMint` に更新

### .github/workflows/deploy.yml
- `knowledge-market-pr-${{ github.event.number }}` → `knowmint-pr-${{ github.event.number }}` (3箇所)

---

## 実装方針

1. **ファイルを個別に Edit** — 各ファイルを Read → Edit (old_string/new_string で正確置換)
2. **並列実行** — 独立ファイルは同一メッセージで並列 Edit
3. **ロジック変更なし** — 表示文字列・設定値のみ。コード動作に影響しない

---

## 検証

```bash
# ビルドが通ること
npm run build

# 残存する旧ブランド名がないか確認 (Solana program名・変数名以外)
grep -r "Knowledge Market" src/ --include="*.ts" --include="*.tsx"
grep -r "knowledge-market" package.json mcp/package.json cli/package.json wrangler.toml

# lint が通ること
npm run lint
```

期待値:
- `grep "Knowledge Market" src/` → 0件
- `npm run build` → エラーなし
- `npm run lint` → エラーなし
