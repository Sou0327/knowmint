import type { IAgentRuntime, Memory, Provider, ProviderResult, State } from "@elizaos/core";
import { apiRequestPaginated, loadConfigFromRuntime } from "../api.js";
import type { SearchItem } from "../types.js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Per-apiKey cache to prevent cross-agent data leakage */
const cacheByKey = new Map<string, { text: string; at: number }>();

/** In-flight request dedup per apiKey */
const inflightByKey = new Map<string, Promise<ProviderResult>>();

function formatTrending(items: SearchItem[]): string {
  if (items.length === 0) return "";

  const lines = items.map((item, i) => {
    const price = item.price_sol != null
      ? `${item.price_sol} SOL`
      : item.price_usdc != null
        ? `${item.price_usdc} USDC`
        : "N/A";
    return `${i + 1}. "${item.title}" (${price}) — id: ${item.id}`;
  });

  return `[KnowMint] Trending knowledge available for purchase:\n${lines.join("\n")}`;
}

export const trendingKnowledgeProvider: Provider = {
  name: "trending-knowledge",
  description: "Provides trending knowledge items from KnowMint marketplace",

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const key = runtime.getSetting("KM_API_KEY");
    if (!key || typeof key !== "string") {
      return { text: "" };
    }

    const now = Date.now();
    const cached = cacheByKey.get(key);
    if (cached && now - cached.at < CACHE_TTL_MS) {
      return { text: cached.text };
    }

    // Dedup concurrent calls for the same key
    const inflight = inflightByKey.get(key);
    if (inflight) return inflight;

    const promise = (async (): Promise<ProviderResult> => {
      try {
        const config = loadConfigFromRuntime(runtime);
        const result = await apiRequestPaginated<SearchItem>(
          config,
          "/api/v1/knowledge?sort_by=popular&per_page=5&page=1",
        );

        const text = formatTrending(result.data);
        cacheByKey.set(key, { text, at: Date.now() });
        return { text };
      } catch {
        return { text: cached?.text ?? "" };
      } finally {
        inflightByKey.delete(key);
      }
    })();

    inflightByKey.set(key, promise);
    return promise;
  },
};
