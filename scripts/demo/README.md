# KnowMint Autonomous Purchase Demo

AI エージェントが MCP 経由で知識を自律的に発見・購入するデモスクリプト。

## 前提条件

- Node.js 22.6+
- `solana-test-validator` (Solana CLI)
- ローカル Supabase (`supabase start`)
- dev server (`npm run dev`)

## セットアップ

### 1. ローカル Supabase 起動

```bash
supabase start
```

### 2. Solana テストバリデータ起動

```bash
solana-test-validator --reset --quiet &
```

### 3. Keypair 生成 & Airdrop

```bash
# buyer keypair 生成
node scripts/e2e/devnet-setup.mjs

# SOL を付与
solana airdrop 10 $(solana-keygen pubkey devnet-buyer-keypair.json) \
  --url http://127.0.0.1:8899
```

### 4. シードデータ投入

```bash
# staging seed を使うか、手動で知識アイテムを作成
npx tsx scripts/seed/staging-seed.ts
```

### 5. Dev Server 起動

```bash
X402_NETWORK="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" \
NEXT_PUBLIC_SOLANA_NETWORK=devnet \
NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899 \
NEXT_PUBLIC_KM_PROGRAM_ID="" \
NEXT_PUBLIC_FEE_VAULT_ADDRESS="" \
npm run dev
```

## デモ実行

```bash
KM_BASE_URL=http://localhost:3000 \
NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899 \
DEMO_BUYER_KEYPAIR_PATH=./devnet-buyer-keypair.json \
node scripts/demo/autonomous-purchase-demo.mjs
```

### 環境変数

| 変数 | 必須 | デフォルト | 説明 |
|------|------|-----------|------|
| `DEMO_BUYER_KEYPAIR_PATH` | Yes | — | buyer keypair JSON パス |
| `KM_BASE_URL` | No | `http://localhost:3000` | dev server URL |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | `http://127.0.0.1:8899` | Solana RPC URL |
| `KM_TEST_KNOWLEDGE_ID` | No | (自動選択) | 購入対象の knowledge item ID |

## 録画手順 (asciinema)

### 1. 録画

```bash
asciinema rec demo-autonomous-purchase.cast \
  --title "KnowMint - AI Agent Autonomous Purchase" \
  --cols 100 --rows 30
# 録画内でデモスクリプトを実行
# exit で録画終了
```

### 2. GIF 変換

```bash
# agg (Rust 製, 推奨)
agg demo-autonomous-purchase.cast demo-autonomous-purchase.gif \
  --font-size 14 --theme monokai

# または asciinema-gif-generator
docker run --rm -v $PWD:/data asciinema/asciicast2gif \
  /data/demo-autonomous-purchase.cast /data/demo-autonomous-purchase.gif
```
