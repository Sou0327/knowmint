# KnowMint MCP Server

**Give your AI agent access to human tacit knowledge — the kind that isn't in any training data.**

Connect Claude Code, Cursor, or OpenCode to [KnowMint](https://knowmint.shop) and let your agent autonomously discover, evaluate, and purchase real-world expertise: battle-tested prompts, live datasets, tool definitions, and hard-won domain know-how.

> **Why agents buy knowledge**: Higher success rates. Fewer retries. Access to current, verified information that no LLM was trained on.

---

## Quickstart (npx — no install needed)

### Claude Code (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "knowmint": {
      "command": "npx",
      "args": ["--yes", "--package", "@knowmint/mcp-server@0.1.2", "mcp-server"],
      "env": {
        "KM_API_KEY": "km_xxx",
        "KM_BASE_URL": "https://knowmint.shop"
      }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "knowmint": {
      "command": "npx",
      "args": ["--yes", "--package", "@knowmint/mcp-server@0.1.2", "mcp-server"],
      "env": {
        "KM_API_KEY": "km_xxx",
        "KM_BASE_URL": "https://knowmint.shop"
      }
    }
  }
}
```

### OpenCode (`.opencode/config.json`)

```json
{
  "mcp": {
    "servers": {
      "knowmint": {
        "command": "npx",
        "args": ["--yes", "--package", "@knowmint/mcp-server@0.1.2", "mcp-server"],
        "env": { "KM_API_KEY": "km_xxx", "KM_BASE_URL": "https://knowmint.shop" }
      }
    }
  }
}
```

> **`KM_BASE_URL`** defaults to `https://knowmint.shop` when omitted.
> Get your API key at [knowmint.shop/settings/api](https://knowmint.shop/settings/api) or run `km login`.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `km_search` | Search knowledge listings by keyword, type, or price |
| `km_get_detail` | Get full metadata + preview for a listing |
| `km_purchase` | Record a purchase after sending payment (tx_hash) |
| `km_get_content` | Retrieve purchased full content |
| `km_publish` | Publish a new knowledge listing |

---

## Authentication

Priority order:
1. `KM_API_KEY` environment variable
2. `~/.km/config.json` (saved by `km login`)

If you've already run `km login`, you can omit the `env` block entirely.

---

## Autonomous Purchase Flow (x402 — no external wallet MCP needed)

Agents with their own wallet (e.g. CDP Wallet) can complete purchases end-to-end without any additional MCP server:

```
1. km_get_content(id)
   → { payment_required: true, accepts: [{ payTo, maxAmountRequired, asset, network, ... }] }

2. Agent sends SOL/USDC from its own wallet
   → obtain tx_hash / signature

3. Build payment_proof:
   base64url(JSON.stringify({
     scheme: "exact",
     network: "<value from accepts[].network>",   // match the network returned above
     payload: { txHash: "<signature>", asset: "native" }
   }))

4. km_get_content(id, payment_proof: "<base64url>")
   → { full_content: "...", file_url: null }
```

> **Note**: Use the `network` value returned in `accepts[]` — do not hardcode it.
> Devnet example: `"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"`

Manual purchase via Phantom MCP also works: send tx → `km_purchase(id, tx_hash)` → `km_get_content(id)`.

---

## Local Development Setup

```bash
cd mcp && npm install && npm run build
```

```json
{
  "mcpServers": {
    "knowmint": {
      "command": "node",
      "args": ["/path/to/knowledge_market/mcp/dist/index.js"],
      "env": { "KM_API_KEY": "km_xxx" }
    }
  }
}
```

### Dev mode (TypeScript, no build step)

```json
{
  "mcpServers": {
    "knowmint": {
      "command": "node",
      "args": ["--experimental-strip-types", "/path/to/knowledge_market/mcp/src/index.ts"],
      "env": { "KM_API_KEY": "km_xxx" }
    }
  }
}
```

### Verify the server starts

```bash
# Should print error to stderr and exit (no KM_API_KEY set)
npx --yes --package @knowmint/mcp-server@0.1.2 mcp-server

# With key — should stay running (waiting for MCP messages on stdin)
KM_API_KEY=km_xxx KM_BASE_URL=http://localhost:3000 npm run dev

# Interactive inspection
npx @modelcontextprotocol/inspector node --experimental-strip-types mcp/src/index.ts
```

---

## Requirements

- Node.js ≥ 22.6.0
- KnowMint API key ([get one here](https://knowmint.shop/settings/api))
