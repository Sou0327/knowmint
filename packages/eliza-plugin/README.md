# @knowmint/eliza-plugin

ElizaOS plugin for [KnowMint](https://knowmint.shop) — lets AI agents discover and purchase human tacit knowledge from the marketplace.

## Installation

```bash
npm install @knowmint/eliza-plugin
```

## Configuration

Add KnowMint settings to your agent's character file:

```json
{
  "name": "my-agent",
  "settings": {
    "secrets": {
      "KM_API_KEY": "km_your64hexchars..."
    },
    "KM_BASE_URL": "https://knowmint.shop"
  },
  "plugins": ["@knowmint/eliza-plugin"]
}
```

| Setting | Required | Description |
|---------|----------|-------------|
| `KM_API_KEY` | Yes | API key from KnowMint (format: `km_<64 hex chars>`) |
| `KM_BASE_URL` | No | API base URL (default: `https://knowmint.shop`) |

### Getting an API Key

1. Create an account at [knowmint.shop](https://knowmint.shop)
2. Navigate to Settings > API Keys
3. Generate a new key and copy it

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `SEARCH_KNOWLEDGE` | Search knowledge items by query | Query in message text |
| `PURCHASE_KNOWLEDGE` | Record a purchase after on-chain payment | `knowledge_id`, `tx_hash` |
| `GET_CONTENT` | Retrieve full content of a purchased item | `knowledge_id` |

### SEARCH_KNOWLEDGE

Searches the KnowMint marketplace. The search query is extracted from the message text.

Optional parameters (via options or message content):
- `content_type`: `prompt` | `tool_def` | `dataset` | `api` | `general`
- `sort_by`: `newest` | `popular` | `price_low` | `price_high` | `rating` | `trust_score`
- `max_results`: 1-50 (default: 20)

### PURCHASE_KNOWLEDGE

Records a purchase after the on-chain payment has been sent. The actual payment should be made using a wallet plugin (e.g., `@elizaos/plugin-solana`).

Required parameters:
- `knowledge_id`: The item ID to purchase
- `tx_hash`: On-chain transaction hash

Optional parameters:
- `token`: `SOL` | `USDC` (default: `SOL`)
- `chain`: Blockchain network (default: `solana`)

### GET_CONTENT

Retrieves the full content of a knowledge item. Supports the x402 autonomous payment flow.

Required parameters:
- `knowledge_id`: The item ID

Optional parameters:
- `payment_proof`: Base64-encoded X-PAYMENT proof for x402 flow

## Provider

| Provider | Description |
|----------|-------------|
| `trending-knowledge` | Injects top 5 trending knowledge items into agent context (5-min cache) |

The trending provider runs automatically and adds marketplace context to the agent's awareness, enabling proactive knowledge discovery.

## x402 Autonomous Purchase Flow

1. Agent calls `GET_CONTENT` for an item it hasn't purchased
2. API returns HTTP 402 with payment requirements
3. Agent sends on-chain payment (via `@elizaos/plugin-solana` or similar)
4. Agent calls `GET_CONTENT` again with `payment_proof` (base64-encoded `{scheme, network, payload: {txHash, asset?}}`)
5. API validates payment and returns full content

## License

MIT
