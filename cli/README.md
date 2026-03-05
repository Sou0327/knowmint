# @knowmint/cli

The official CLI for [KnowMint](https://knowmint.shop) — the AI-native knowledge marketplace where agents autonomously purchase knowledge via the x402 protocol on Solana.

## Installation

```bash
npm install -g @knowmint/cli
```

Or run without installing:

```bash
npx @knowmint/cli help
```

**Requires Node.js ≥ 18.17.0**

## Quick Start

```bash
# 1. Connect your Solana wallet (creates an API key automatically)
km wallet-login --keypair ~/.config/solana/id.json

# 2. Search for knowledge
km search "Claude Code prompts"

# 3. Buy and install into your Claude Code config
km install <id> --deploy-to claude
```

## Commands

```
km register              Create an account with a Solana keypair
km wallet-login          Log in with a Solana keypair (gets/creates an API key)
km login --api-key <key> Log in with an existing API key
km logout                Clear saved credentials

km search <query>        Search the marketplace
km install <id>          Purchase and download knowledge (supports --keypair for auto-payment)
km publish prompt <file> Publish a prompt to the marketplace
km publish mcp <file>    Publish an MCP tool definition
km publish dataset <file>Publish a dataset

km my purchases          List your purchases
km my listings           List your published items
km versions <id>         Show version history for an item

km config                Show current config (base URL, API key)
km help                  Show this help
```

## Purchase & Deploy

```bash
# Automatic payment with a Solana keypair (send SOL + purchase + download)
km install <knowledge-id> --keypair ~/.config/solana/id.json --rpc-url https://api.devnet.solana.com

# Buy and auto-deploy to Claude Code (~/.claude/mcp.json)
km install <knowledge-id> --keypair ~/.config/solana/id.json --rpc-url <rpc-url> --deploy-to claude

# Buy and auto-deploy to OpenCode
km install <knowledge-id> --deploy-to opencode

# Specify token (default: SOL)
km install <knowledge-id> --token USDC

# If you already have a transaction hash (e.g. paid manually)
km install <knowledge-id> --tx-hash <solana-tx-hash>
```

### Automatic Payment (`--keypair`)

When `--keypair` is provided, the CLI handles the entire purchase flow:

1. Reads the seller's wallet address from the API
2. Sends SOL directly from your keypair to the seller
3. Registers the purchase with the transaction hash
4. Downloads the content

**Safety features:**
- RPC URL is required (`--rpc-url` or `SOLANA_RPC_URL`) — no silent mainnet default
- Keypair file must have `chmod 600` permissions
- Idempotent: re-running the same command skips payment if already purchased
- Crash recovery: transaction hash is persisted before confirmation
- Lock file prevents parallel double-spend

## Publishing

```bash
# Publish a prompt file
km publish prompt my-prompt.md \
  --price 0.01SOL \
  --title "My Claude Prompt" \
  --description "Optimized for code review" \
  --tags "claude,code-review,productivity"

# Publish an MCP server definition
km publish mcp my-tool.json --price 0.05SOL

# Publish a dataset
km publish dataset data.jsonl --price 0.1SOL --content-type application/jsonl
```

## Configuration

Credentials are stored in `~/.km/config.json`.

```bash
# Use a custom API endpoint (e.g. local dev)
km login --api-key km_xxx --base-url http://localhost:3000
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KM_BASE_URL` | `https://knowmint.shop` | API base URL |
| `KM_API_KEY` | — | API key (overrides saved config) |
| `SOLANA_RPC_URL` | — | Solana RPC URL for `--keypair` auto-payment |

## License

MIT
