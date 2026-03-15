name: KnowMint
description: AI agent knowledge marketplace with x402 autonomous payments on Solana. Agents discover, purchase, and retrieve human experiential knowledge via MCP tools.
version: 0.1.2
author: Sou0327
license: MIT
tags: [knowledge, marketplace, x402, solana, mcp, ai-agent, payments, claude-code]
capabilities:
  - search knowledge items by keyword, category, and price range
  - get detailed item information with preview content
  - purchase knowledge with SOL via x402 protocol
  - retrieve full purchased content
  - publish new knowledge items
  - get version history of knowledge items
install:
  mcp: npx --yes @knowmint/mcp-server
  cli: npx km
urls:
  homepage: https://knowmint.shop
  repository: https://github.com/Sou0327/knowmint
  npm: https://www.npmjs.com/package/@knowmint/mcp-server
