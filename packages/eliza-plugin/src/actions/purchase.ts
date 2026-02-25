import type {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  HandlerOptions,
} from "@elizaos/core";
import { apiRequest, KmApiError, loadConfigFromRuntime } from "../api.js";
import type { PurchaseResponse } from "../types.js";

const KNOWLEDGE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const TX_HASH_RE = /^[a-zA-Z0-9]+$/;
const MAX_TX_HASH_LEN = 256;
const VALID_TOKENS = new Set(["SOL", "USDC"]);
const VALID_CHAINS = new Set(["solana"]);

export const purchaseKnowledgeAction: Action = {
  name: "PURCHASE_KNOWLEDGE",
  similes: ["BUY_KNOWLEDGE", "ACQUIRE_KNOWLEDGE", "PURCHASE_KNOWMINT"],
  description:
    "Record a knowledge purchase on KnowMint after sending on-chain payment. " +
    "Requires knowledge_id and tx_hash. The payment must already be sent on-chain " +
    "(e.g. via @elizaos/plugin-solana) before calling this action.",

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

      const content = message.content as Record<string, unknown>;
      const knowledgeId = (options?.["knowledge_id"] ?? content?.["knowledge_id"]) as string | undefined;
      const txHash = (options?.["tx_hash"] ?? content?.["tx_hash"]) as string | undefined;
      const token = (options?.["token"] ?? content?.["token"]) as string | undefined;
      const chain = (options?.["chain"] ?? content?.["chain"]) as string | undefined;

      if (!knowledgeId || typeof knowledgeId !== "string") {
        const text = "Missing required parameter: knowledge_id";
        if (callback) await callback({ text });
        return { success: false, error: text };
      }

      if (!KNOWLEDGE_ID_RE.test(knowledgeId)) {
        const text = "Invalid knowledge_id format. Must be alphanumeric with hyphens/underscores only.";
        if (callback) await callback({ text });
        return { success: false, error: text };
      }

      if (!txHash || typeof txHash !== "string") {
        const text = "Missing required parameter: tx_hash (on-chain transaction hash)";
        if (callback) await callback({ text });
        return { success: false, error: text };
      }

      if (txHash.length > MAX_TX_HASH_LEN || !TX_HASH_RE.test(txHash)) {
        const text = "Invalid tx_hash format. Must be alphanumeric, max 256 chars.";
        if (callback) await callback({ text });
        return { success: false, error: text };
      }

      // Validate token: default to SOL only if not provided (undefined/null)
      if (token != null && typeof token !== "string") {
        const text = "Invalid token parameter: must be a string.";
        if (callback) await callback({ text });
        return { success: false, error: text };
      }
      const resolvedToken = (token ?? "SOL").toUpperCase();
      if (!VALID_TOKENS.has(resolvedToken)) {
        const text = `Invalid token. Supported: ${[...VALID_TOKENS].join(", ")}`;
        if (callback) await callback({ text });
        return { success: false, error: text };
      }

      // Validate chain: default to solana only if not provided (undefined/null)
      if (chain != null && typeof chain !== "string") {
        const text = "Invalid chain parameter: must be a string.";
        if (callback) await callback({ text });
        return { success: false, error: text };
      }
      const resolvedChain = (chain ?? "solana").toLowerCase();
      if (!VALID_CHAINS.has(resolvedChain)) {
        const text = `Invalid chain. Supported: ${[...VALID_CHAINS].join(", ")}`;
        if (callback) await callback({ text });
        return { success: false, error: text };
      }

      const data = await apiRequest<PurchaseResponse>(
        config,
        `/api/v1/knowledge/${encodeURIComponent(knowledgeId)}/purchase`,
        "POST",
        {
          tx_hash: txHash,
          token: resolvedToken,
          chain: resolvedChain,
        },
      );

      const text = [
        "Purchase recorded successfully!",
        `- Item: ${data.knowledge_item_id}`,
        `- Amount: ${data.amount} ${data.token}`,
        `- Status: ${data.status}`,
        `- TX: ${data.tx_hash}`,
      ].join("\n");

      if (callback) await callback({ text });
      return { success: true, text, data: { purchase: data } };
    } catch (e) {
      const msg = e instanceof KmApiError
        ? `KnowMint API Error (${e.status ?? "unknown"}): ${e.message}`
        : `Error recording purchase: ${(e as Error).message}`;

      if (callback) await callback({ text: msg });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      {
        name: "user",
        content: {
          text: "Record my KnowMint purchase",
          knowledge_id: "abc123",
          tx_hash: "5xY...abc",
        },
      },
      {
        name: "assistant",
        content: {
          text: "I'll record your purchase on KnowMint.",
          actions: ["PURCHASE_KNOWLEDGE"],
        },
      },
    ],
  ],
};
