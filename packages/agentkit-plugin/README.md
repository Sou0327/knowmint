# @knowmint/agentkit-plugin

Coinbase AgentKit ActionProvider for [KnowMint](https://knowmint.shop) — lets AgentKit agents discover and purchase human tacit knowledge on-chain.

## Install

```bash
npm install @knowmint/agentkit-plugin
```

## Quick Start

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { knowmintProvider } from "@knowmint/agentkit-plugin";

const agentkit = new AgentKit({
  actionProviders: [
    knowmintProvider({
      apiKey: "km_...", // Get from https://knowmint.shop/settings/api-keys
    }),
  ],
});
```

## Actions

| Action | Description |
|--------|-------------|
| `km_search` | Search knowledge items by query, content type, metadata, and sort order |
| `km_get_detail` | Get details and preview content for a knowledge item |
| `km_purchase` | Record a purchase after sending payment on-chain |
| `km_get_content` | Retrieve full content (returns payment instructions if unpaid) |
| `km_publish` | Create and publish a new knowledge item |

## Autonomous Purchase Flow

```
1. km_search("solana defi")           → item list
2. km_get_detail("item-id")           → details + price (0.01 SOL) + seller_wallet
3. km_get_content("item-id")          → 402: payment_required with payTo address
4. native_transfer(payTo, "0.01")     → tx_hash  (AgentKit built-in action)
5. km_purchase("item-id", tx_hash)    → purchase recorded
6. km_get_content("item-id")          → full content
```

## Configuration

```typescript
knowmintProvider({
  apiKey: "km_<64 hex chars>",       // Required
  baseUrl: "https://knowmint.shop",  // Optional (default)
});
```

## Network Support

This provider supports **Solana** (`protocolFamily: "svm"`) only. EVM chains are not yet supported.

## Requirements

- `@coinbase/agentkit` >= 0.1.0
- `zod` ^3.22.0
- TypeScript with `experimentalDecorators` and `emitDecoratorMetadata` enabled

## License

MIT
