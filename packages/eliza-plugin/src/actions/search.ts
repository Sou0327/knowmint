import type {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  HandlerOptions,
} from "@elizaos/core";
import { apiRequestPaginated, KmApiError, loadConfigFromRuntime } from "../api.js";
import type { SearchItem } from "../types.js";

const MAX_QUERY_LEN = 200;
const VALID_CONTENT_TYPES = new Set(["prompt", "tool_def", "dataset", "api", "general"]);
const VALID_SORT_BY = new Set(["newest", "popular", "price_low", "price_high", "rating", "trust_score"]);

function formatSearchResults(items: SearchItem[]): string {
  if (items.length === 0) return "No results found.";

  const lines: string[] = [`${items.length} result(s) found:\n`];
  for (const item of items) {
    const score = item.usefulness_score != null
      ? `[Quality: ${item.usefulness_score.toFixed(2)}] `
      : "";
    const trust = item.seller?.trust_score != null
      ? `[Trust: ${item.seller.trust_score.toFixed(2)}] `
      : "";
    const price = item.price_sol != null
      ? `${item.price_sol} SOL`
      : item.price_usdc != null
        ? `${item.price_usdc} USDC`
        : "N/A";

    lines.push(`- ${score}${trust}"${item.title}" (${price}) — id: ${item.id}`);
    if (item.tags && item.tags.length > 0) {
      lines.push(`  Tags: ${item.tags.map((t) => `#${t}`).join(" ")}`);
    }
    if (item.metadata) {
      const parts: string[] = [];
      if (item.metadata.domain) parts.push(`domain=${item.metadata.domain}`);
      if (item.metadata.experience_type) parts.push(`type=${item.metadata.experience_type}`);
      if (parts.length > 0) lines.push(`  Metadata: ${parts.join(", ")}`);
    }
  }
  return lines.join("\n");
}

export const searchKnowledgeAction: Action = {
  name: "SEARCH_KNOWLEDGE",
  similes: ["FIND_KNOWLEDGE", "LOOKUP_KNOWLEDGE", "SEARCH_KNOWMINT"],
  description:
    "Search for knowledge items on KnowMint marketplace. " +
    "Returns titles, prices, quality scores, and tags. " +
    "Use this to discover available tacit knowledge before purchasing.",

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const key = runtime.getSetting("KM_API_KEY");
    return typeof key === "string" && key.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: HandlerOptions,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const config = loadConfigFromRuntime(runtime);

      let query = (typeof message.content?.text === "string" && message.content.text.trim())
        ? message.content.text.trim()
        : "";

      if (!query) {
        const text = "Please provide a search query for knowledge items.";
        if (callback) await callback({ text });
        return { success: false, error: text };
      }

      // Cap query length to prevent oversized requests
      if (query.length > MAX_QUERY_LEN) {
        query = query.slice(0, MAX_QUERY_LEN);
      }

      const params = new URLSearchParams({ query, page: "1" });

      const contentType = options?.["content_type"];
      if (typeof contentType === "string" && VALID_CONTENT_TYPES.has(contentType)) {
        params.set("content_type", contentType);
      }

      const sortBy = options?.["sort_by"];
      if (typeof sortBy === "string" && VALID_SORT_BY.has(sortBy)) {
        params.set("sort_by", sortBy);
      }

      const maxResults = options?.["max_results"];
      const perPage = typeof maxResults === "number" && Number.isFinite(maxResults)
        ? Math.min(Math.max(1, Math.floor(maxResults)), 50)
        : 20;
      params.set("per_page", String(perPage));

      const result = await apiRequestPaginated<SearchItem>(
        config,
        `/api/v1/knowledge?${params.toString()}`,
      );

      const text = formatSearchResults(result.data);
      if (callback) await callback({ text });
      return { success: true, text, data: { items: result.data } };
    } catch (e) {
      const msg = e instanceof KmApiError
        ? `KnowMint API Error (${e.status ?? "unknown"}): ${e.message}`
        : `Error searching knowledge: ${(e as Error).message}`;

      if (callback) await callback({ text: msg });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Search for Solana MEV strategies on KnowMint" },
      },
      {
        name: "assistant",
        content: {
          text: "I'll search KnowMint for Solana MEV strategies.",
          actions: ["SEARCH_KNOWLEDGE"],
        },
      },
    ],
    [
      {
        name: "user",
        content: { text: "Find prompt engineering knowledge" },
      },
      {
        name: "assistant",
        content: {
          text: "Let me search KnowMint for prompt engineering knowledge.",
          actions: ["SEARCH_KNOWLEDGE"],
        },
      },
    ],
  ],
};
