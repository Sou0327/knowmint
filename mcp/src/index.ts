#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./api.ts";
import { registerTools } from "./tools.ts";

async function main(): Promise<void> {
  const config = await loadConfig(); // apiKey null 許容 (km_register で後から取得可)

  const server = new McpServer({
    name: "knowmint",
    version: "0.1.0",
  });

  registerTools(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // ホスト名のみ表示 (URL にパスや credentials が含まれる場合の情報漏洩を防ぐ)
  const host = new URL(config.baseUrl).host;
  const keyStatus = config.apiKey ? "key configured" : "no key (use km_register)";
  process.stderr.write(`[km-mcp] running (host: ${host}, ${keyStatus})\n`);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`[km-mcp] fatal: ${msg}\n`);
  process.exit(1);
});
