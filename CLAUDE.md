# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KnowMint — 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス。
仮想通貨(Solana→マルチチェーン)で決済。3つのアクセスレイヤー: Web UI / CLI (`km`) / REST API+MCP。

### コアバリュー

- **人間→AIへの知識供給**: AIが自力で獲得できない体験知・暗黙知・感性を、人間が出品しAIエージェントが自律購入する
- **人間の新しい収益源**: 自分の経験・知識を構造化して出品するだけで、AIエージェント(OpenClaw等)が発見・購入してくれる
- **AIが買えない知識に価値がある**: `tool_def`(ツール定義)、`dataset`(現場データ)、業界の暗黙知、失敗事例など、LLMの学習データに存在しないナレッジが主な取引対象
- **ノンカストディアル決済**: 買い手→売り手のP2P直接送金。運営は秘密鍵を持たず、tx_hash検証と記録のみ。将来的にスマートコントラクト自動分配でプロトコル手数料を徴収予定

## Commands

```bash
npm run dev              # 開発サーバー (localhost:3000)
npm run build            # プロダクションビルド
npm run lint             # ESLint
npm run km -- <command>  # CLI ツール (cli/bin/km.mjs)
npm run test:e2e:cli-flow     # CLI E2E テスト
npm run test:e2e:fake-tx      # 偽トランザクション拒否テスト
```

## Architecture

**Next.js 16 App Router + Supabase + Solana/EVM マルチチェーン決済**

### Supabase クライアント使い分け (重要)

| クライアント | ファイル | 用途 | RLS |
| --- | --- | --- | --- |
| Browser | `lib/supabase/client.ts` | クライアントコンポーネント | 適用 |
| Server | `lib/supabase/server.ts` | RSC, Server Actions | 適用 |
| Admin | `lib/supabase/admin.ts` | API routes のみ | **バイパス** |

API routes は Admin クライアントで RLS をバイパスし、`withApiAuth` 内で手動認可する。

### API Route パターン

全 API route は `withApiAuth` HOC を使用:

```typescript
// src/app/api/v1/<resource>/route.ts
export const GET = withApiAuth(async (request, user, rateLimit, context) => {
  const supabase = getAdminClient();
  // ... query + manual authorization ...
  return apiSuccess(data);
}, { requiredPermissions: ["read"] });
```

認証フロー: IP レート制限 → API キー認証 (SHA-256) → パーミッション検査 → キー別レート制限

### コンテンツ分離 (セキュリティ)

- `knowledge_items` — 公開情報 + `preview_content`
- `knowledge_item_contents` — 購入者のみアクセス可 (RLS で保護)

### ウォレット統合

- **Solana**: `contexts/WalletContext.tsx` → `@solana/wallet-adapter-react` (Phantom, Solflare)
- **EVM**: `contexts/EVMWalletContext.tsx` → `wagmi` v3 + `viem` (Base, Ethereum / MetaMask, Coinbase Wallet)
- **チェーン選択**: `contexts/ChainContext.tsx` で管理

### CLI ツール (`cli/bin/km.mjs`)

スタンドアロン Node.js CLI。設定は `~/.km/config.json` に保存。
`--deploy-to claude,opencode` で購入ナレッジを自動デプロイ。

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=...           # Supabase プロジェクト URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # Supabase Anon Key
SUPABASE_SERVICE_ROLE_KEY=...          # Admin クライアント用 (API routes)
NEXT_PUBLIC_SOLANA_RPC_URL=...         # Solana RPC (default: mainnet-beta)
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

## Content Types (DB enum)

`prompt` | `tool_def` | `dataset` | `api` | `general`

## Key Conventions

- **UI コンポーネント**: `components/ui/` (汎用) / `components/features/` (ドメイン固有)
- **型定義**: `database.types.ts` (DB スキーマ) / `knowledge.types.ts` (ドメイン型)
- **DB クエリ**: `lib/<feature>/queries.ts` にまとめる
- **バリデーション**: Zod で API 入力を検証
- **レスポンス**: `apiSuccess()` / `apiError()` / `apiPaginated()` を使用

## Development Rules

- **Codex レビュー必須**: 実装後 `mcp__codex__codex` で Security/Performance/Quality レビュー。レビューなしマージ禁止
- **Codex レビュー反復**: レビュー指摘を修正 → 再レビュー → 指摘ゼロになるまで繰り返す。指摘が残っている状態で完了としない
- **UI 実装は frontend-design スキル必須**: `document-skills:frontend-design` スキル経由で実装
- **API route では Admin クライアント + 手動認可**: RLS に頼らず明示的にチェック
- **API キーは SHA-256 ハッシュで保存**: 平文保存禁止
- **fire-and-forget は reject handler 必須**: `.then(() => {}, () => {})`
- **ライブラリ仕様は Context7 で確認**: バージョン依存の API・設定・型定義が不明な場合、`mcp__context7__resolve-library-id` → `mcp__context7__query-docs` で最新ドキュメントを参照してから実装する
