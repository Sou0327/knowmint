#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./api.js";
import { registerTools } from "./tools.js";
async function main() {
    const config = await loadConfig(); // 失敗時は stderr + exit(1)
    const server = new McpServer({
        name: "knowledge-market",
        version: "0.1.0",
    });
    registerTools(server, config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // ホスト名のみ表示 (URL にパスや credentials が含まれる場合の情報漏洩を防ぐ)
    const host = new URL(config.baseUrl).host;
    process.stderr.write(`[km-mcp] running (host: ${host})\n`);
}
main().catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[km-mcp] fatal: ${msg}\n`);
    process.exit(1);
});
