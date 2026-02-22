# Phase 28: .env.local.example 環境変数補完

## Context

ベータ公開前の設定ドキュメント整備。現在の `.env.local.example` には以下の環境変数が未記載で、
設定漏れによる障害リスクがある:

- `CRON_SECRET` — cleanup-pending-tx cron 認証トークン (本番必須)
- `X402_NETWORK` — x402 CAIP-2 ネットワーク識別子 (x402使用時必須、fail-close)
- `NEXT_PUBLIC_KM_PROGRAM_ID` — Anchor スマートコントラクト Program ID (任意)
- `NEXT_PUBLIC_FEE_VAULT_ADDRESS` — Fee Vault アドレス (任意)

`WEBHOOK_SIGNING_KEY` と `UPSTASH_REDIS_REST_URL/TOKEN` は既存で記載済み。

## 対象ファイル

- `.env.local.example` — 追記対象 (唯一の変更ファイル)

## 各変数の仕様 (調査結果)

| 変数 | 参照ファイル | 挙動 |
|------|-------------|------|
| `CRON_SECRET` | `src/app/api/cron/cleanup-pending-tx/route.ts:16` | 未設定は dev のみ通過、prod は 401 |
| `X402_NETWORK` | `src/lib/x402/index.ts:22,73` | 未設定は 500 (fail-close) |
| `NEXT_PUBLIC_KM_PROGRAM_ID` | `src/lib/solana/program.ts:21` | 未設定は P2P 直接送金フォールバック |
| `NEXT_PUBLIC_FEE_VAULT_ADDRESS` | `src/lib/solana/program.ts:31` | 未設定は fee = 0, vault = null |

## 実装手順

### 1. `.env.local.example` に不足変数を追記

現在の末尾 (`UPSTASH_REDIS_REST_TOKEN=xxx` の後) に以下を追加:

```
# Cron job 認証 (本番環境で必須)
# openssl rand -base64 32 で生成
CRON_SECRET=

# x402 ペイウォール プロトコル (x402 を使用する場合は必須)
# 許可値: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp (mainnet)
#          solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1 (devnet)
# 未設定・不正値は内部エラーで停止 (fail-close)
X402_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1

# Anchor スマートコントラクト (任意 — 未設定時は P2P 直接送金)
# scripts/generate-fee-vault.mjs で keypair 生成後に設定
NEXT_PUBLIC_KM_PROGRAM_ID=
NEXT_PUBLIC_FEE_VAULT_ADDRESS=
```

### 2. WEBHOOK_SIGNING_KEY のコメント強化 (任意)

既存行:
```
WEBHOOK_SIGNING_KEY=  # openssl rand -hex 32 で生成
```

改善案:
```
# Webhook HMAC 署名鍵 (64文字の16進数、32 bytes)
# openssl rand -hex 32 で生成。未設定時は Webhook 署名機能が無効化
WEBHOOK_SIGNING_KEY=
```

## 完成後の .env.local.example 構造

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=

# Webhook HMAC 署名鍵 (64文字の16進数、32 bytes)
# openssl rand -hex 32 で生成。未設定時は Webhook 署名機能が無効化
WEBHOOK_SIGNING_KEY=

# Upstash Redis (レート制限 — オプション。未設定時はメモリフォールバック)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Cron job 認証 (本番環境で必須)
# openssl rand -base64 32 で生成
CRON_SECRET=

# x402 ペイウォール プロトコル (x402 を使用する場合は必須)
# 許可値: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp (mainnet)
#          solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1 (devnet)
# 未設定・不正値は内部エラーで停止 (fail-close)
X402_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1

# Anchor スマートコントラクト (任意 — 未設定時は P2P 直接送金)
# scripts/generate-fee-vault.mjs で keypair 生成後に設定
NEXT_PUBLIC_KM_PROGRAM_ID=
NEXT_PUBLIC_FEE_VAULT_ADDRESS=
```

## 検証

- `git diff .env.local.example` で 4 変数が追加されていることを確認
- `.env.local` に `X402_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` があれば `npm run build` が通ることを確認

## スコープ外

- `.env.test.example` は別ファイル — 今回は変更しない
- `.env.local` (実値ファイル) は変更しない
