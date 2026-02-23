import { KnowledgeMarketClient, KmApiError } from "../src/index.js";
import type { KnowledgeItem } from "../src/index.js";

// OpenClaw エージェントが KnowMint を活用するサンプル
// 実際の OpenClaw Tool 定義に統合する想定

const client = new KnowledgeMarketClient({
  apiKey: process.env["KM_API_KEY"]!,
  baseUrl: process.env["KM_BASE_URL"] ?? "http://127.0.0.1:3000",
});

/**
 * エージェントのナレッジ獲得フロー。
 * 1. 関連ナレッジを検索
 * 2. 予算内の最高品質アイテムを選定
 * 3. 購入記録 (実際のオンチェーン決済は別途行う)
 * 4. コンテンツ取得
 */
async function acquireKnowledge(
  topic: string,
  maxBudgetSol: number
): Promise<KnowledgeItem | null> {
  // 1. 関連ナレッジを検索 (信頼度順)
  let results;
  try {
    results = await client.search({
      query: topic,
      sort_by: "trust_score",
      max_results: 5,
    });
  } catch (err) {
    if (err instanceof KmApiError) {
      console.error(`Search failed [${err.status}]: ${err.message}`);
    } else {
      console.error("Search failed:", err);
    }
    return null;
  }

  if (results.data.length === 0) {
    console.log("No relevant knowledge found");
    return null;
  }

  // 2. 予算内で最も高い trust_score を持つアイテムを選定
  const candidate = results.data.find(
    (item) => item.price_sol !== null && item.price_sol <= maxBudgetSol
  );

  if (!candidate) {
    console.log(
      `No items within budget (max: ${maxBudgetSol} SOL). Cheapest: ${results.data[0]?.price_sol} SOL`
    );
    return null;
  }

  console.log(
    `Selected: "${candidate.title}" by ${candidate.seller?.display_name ?? "unknown"} (${candidate.price_sol} SOL, trust: ${candidate.seller?.trust_score ?? "N/A"})`
  );

  // 3. 購入記録 (実際のオンチェーン決済後に呼び出す)
  // オンチェーンで SOL を送金してから txHash を渡す:
  //
  // const purchase = await client.recordPurchase({
  //   knowledgeId: candidate.id,
  //   txHash: "actual_tx_hash_from_on_chain_transfer",
  //   token: "SOL",
  //   chain: "solana",
  // });
  // console.log(`Purchase recorded: ${purchase.id} (${purchase.status})`);

  // 4. コンテンツ取得 (購入確定後に有効化される)
  // const content = await client.getContent(candidate.id);
  // console.log(`Content preview: ${content.full_content?.slice(0, 200)}`);

  return candidate;
}

/**
 * OpenClaw Tool 定義サンプル。
 * エージェントフレームワークの tool_definitions に登録する想定。
 */
export const knowledgeMarketTools = [
  {
    name: "km_search",
    description: "KnowMint でナレッジを検索する。AIが自力で獲得できない体験知・暗黙知を人間の売り手から購入できる。",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "検索トピック (日本語可)",
        },
        max_budget_sol: {
          type: "number",
          description: "最大予算 (SOL)",
          default: 0.1,
        },
      },
      required: ["topic"],
    },
    execute: async (args: { topic: string; max_budget_sol?: number }) => {
      const item = await acquireKnowledge(args.topic, args.max_budget_sol ?? 0.1);
      if (!item) return { found: false };
      return {
        found: true,
        item: {
          id: item.id,
          title: item.title,
          description: item.description,
          price_sol: item.price_sol,
          seller_trust_score: item.seller?.trust_score,
        },
      };
    },
  },
];

// 単体実行用エントリポイント
if (process.argv[1]?.endsWith("openclaw-integration.ts")) {
  acquireKnowledge("React performance optimization", 0.5).catch(console.error);
}
