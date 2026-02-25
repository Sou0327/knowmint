import type { Plugin, IAgentRuntime } from "@elizaos/core";
import { searchKnowledgeAction } from "./actions/search.js";
import { purchaseKnowledgeAction } from "./actions/purchase.js";
import { getContentAction } from "./actions/get-content.js";
import { trendingKnowledgeProvider } from "./providers/trending.js";

export const knowmintPlugin: Plugin = {
  name: "@knowledge-market/eliza-plugin",
  description:
    "KnowMint plugin for ElizaOS — discover and purchase human tacit knowledge from the marketplace",

  init: async (_config: Record<string, string>, runtime: IAgentRuntime): Promise<void> => {
    const key = runtime.getSetting("KM_API_KEY");
    if (!key) {
      console.warn(
        "[knowmint] KM_API_KEY is not configured. " +
        "KnowMint actions will be disabled until an API key is provided.",
      );
    }
  },

  actions: [searchKnowledgeAction, purchaseKnowledgeAction, getContentAction],
  providers: [trendingKnowledgeProvider],
};

export default knowmintPlugin;

// Re-export types and utilities for advanced usage
export { KmApiError, loadConfigFromRuntime } from "./api.js";
export type { KmConfig, PaymentRequiredResponse } from "./api.js";
export type {
  SearchItem,
  KnowledgeDetail,
  ContentResponse,
  PurchaseResponse,
} from "./types.js";
