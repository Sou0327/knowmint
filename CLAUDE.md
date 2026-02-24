# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KnowMint — 人間の暗黙知・体験知をAIエージェントに販売できるナレッジマーケットプレイス。
仮想通貨(Solana→マルチチェーン)で決済。3つのアクセスレイヤー: Web UI / CLI (`km`) / REST API+MCP。

人間が体験知・暗黙知を出品 → AIエージェント(OpenClaw等)が自律発見・購入。買い手→売り手 P2P 直接送金(秘密鍵は運営非保有)。

## Commands

```bash
npm run dev              # 開発サーバー (localhost:3000)
npm run build            # プロダクションビルド
npm run lint             # ESLint
npm run km -- <command>  # CLI ツール (cli/bin/km.mjs)
npm run km-mcp           # MCP サーバー (stdio) ※ Node.js 22.6+ 必須
npm run build:cf         # Cloudflare Workers ビルド
npm run deploy:cf        # Cloudflare Workers デプロイ
npm run test:unit             # Unit テスト (111件)
npm run test:staging          # Staging 統合テスト
npm run test:e2e:cli-flow     # CLI E2E テスト
npm run test:e2e:fake-tx      # 偽トランザクション拒否テスト
npm run test:e2e:x402-flow    # HTTP 402 ペイメントゲートテスト
npm run test:e2e:devnet       # devnet 実送金テスト
npm run test:e2e:ui           # Maestro UI E2E (18フロー)
```

## Architecture

Next.js 16 App Router + Supabase + Solana/EVM マルチチェーン決済。詳細は @docs/architecture.md 参照。

### Supabase クライアント使い分け (重要)

| クライアント | ファイル | 用途 | RLS |
| --- | --- | --- | --- |
| Browser | `lib/supabase/client.ts` | クライアントコンポーネント | 適用 |
| Server | `lib/supabase/server.ts` | RSC, Server Actions | 適用 |
| Admin | `lib/supabase/admin.ts` | API routes のみ | **バイパス** |

API routes は Admin クライアントで RLS をバイパスし、`withApiAuth` 内で手動認可する。

### API Route パターン

ほとんどの route は `withApiAuth` HOC + `getAdminClient()` + `apiSuccess()`/`apiError()` を使用。
`/api/v1/keys` は例外 (独自認証)。認証フロー: IP rate limit → APIキー(SHA-256) → パーミッション → キー別 rate limit

### コンテンツ分離 (セキュリティ)

- `knowledge_items` — 公開情報 + `preview_content`
- `knowledge_item_contents` — 購入者のみアクセス可 (RLS で保護)

## Environment Variables

必須: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`

本番必須: `X402_NETWORK` (content API) / `CRON_SECRET` / `WEBHOOK_SIGNING_KEY` / `UPSTASH_REDIS_REST_URL+TOKEN`

詳細・注意事項は @docs/architecture.md 参照。

## Content Types (DB enum)

`prompt` | `tool_def` | `dataset` | `api` | `general`

## UI デザイン方針

KnowMint の UI はドラゴンクエスト等の**レトロRPGゲーム風**デザインを採用している。

- **テーマ**: DQ ウィンドウ (`dq-window`)・濃紺背景・ドット絵テイスト
- **フォント**: DotGothic16 (日本語ドットフォント) + Geist Sans
- **カラー変数**: `--dq-gold`, `--dq-cyan`, `--dq-bg` 等 (`globals.css` 参照)
- **ウィンドウ枠**: 二重ボーダー (`dq-window` / `dq-window-sm` ユーティリティ)
- **UI 新規実装時**: 上記のレトロゲーム風テイストを維持すること

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
