import { KnowledgeMarketClient } from "../src/index.js";

const client = new KnowledgeMarketClient({
  apiKey: process.env["KM_API_KEY"]!,
  baseUrl: process.env["KM_BASE_URL"] ?? "http://127.0.0.1:3000",
});

async function main() {
  // ナレッジを検索
  const results = await client.search({ query: "prompt engineering" });
  console.log(`Found ${results.pagination.total} items`);

  for (const item of results.data) {
    console.log(
      `- ${item.title} (${item.price_sol} SOL) [trust: ${item.seller?.trust_score ?? "N/A"}]`
    );
  }

  // 詳細取得
  if (results.data.length > 0) {
    const firstItem = results.data[0];
    if (!firstItem) return;

    const detail = await client.getItem(firstItem.id);
    console.log(`Preview: ${detail.preview_content?.slice(0, 100)}`);

    // バージョン履歴
    const versionResult = await client.getVersionHistory(firstItem.id);
    console.log(`Versions: ${versionResult.data.length} (total: ${versionResult.pagination.total})`);
  }
}

main().catch(console.error);
