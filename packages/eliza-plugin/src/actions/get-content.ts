import type {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  HandlerOptions,
} from "@elizaos/core";
import {
  apiRequestWithPayment,
  KmApiError,
  loadConfigFromRuntime,
} from "../api.js";
import type { PaymentRequiredResponse } from "../api.js";
import type { ContentResponse } from "../types.js";

const KNOWLEDGE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const MAX_PAYMENT_PROOF_LEN = 4096;
const PAYMENT_PROOF_RE = /^[A-Za-z0-9+/=]+$/;
const CONTENT_TRUNCATE_LEN = 8000;

function isPaymentRequired(data: unknown): data is PaymentRequiredResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as PaymentRequiredResponse).payment_required === true
  );
}

export const getContentAction: Action = {
  name: "GET_CONTENT",
  similes: ["GET_KNOWLEDGE_CONTENT", "FETCH_CONTENT", "RETRIEVE_CONTENT"],
  description:
    "Retrieve the full content of a purchased knowledge item from KnowMint. " +
    "If the item hasn't been purchased yet, returns payment requirements (HTTP 402). " +
    "Supports x402 payment proof for autonomous purchase flows.",

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
      const paymentProof = (options?.["payment_proof"] ?? content?.["payment_proof"]) as string | undefined;

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

      // Validate payment_proof format and length before passing as header
      let extraHeaders: Record<string, string> | undefined;
      if (typeof paymentProof === "string" && paymentProof) {
        if (paymentProof.length > MAX_PAYMENT_PROOF_LEN) {
          const text = `payment_proof too long (max ${MAX_PAYMENT_PROOF_LEN} chars).`;
          if (callback) await callback({ text });
          return { success: false, error: text };
        }
        if (!PAYMENT_PROOF_RE.test(paymentProof)) {
          const text = "payment_proof must be base64-encoded.";
          if (callback) await callback({ text });
          return { success: false, error: text };
        }
        extraHeaders = { "X-PAYMENT": paymentProof };
      }

      const data = await apiRequestWithPayment<ContentResponse>(
        config,
        `/api/v1/knowledge/${encodeURIComponent(knowledgeId)}/content`,
        extraHeaders,
      );

      if (isPaymentRequired(data)) {
        const text = [
          "Payment required to access this content.",
          `x402 Version: ${data.x402Version ?? "unknown"}`,
          data.error ? `Reason: ${data.error}` : null,
          "Send payment on-chain and retry with payment_proof parameter.",
          data.accepts && data.accepts.length > 0
            ? `Accepted methods: ${JSON.stringify(data.accepts)}`
            : null,
        ].filter(Boolean).join("\n");

        if (callback) await callback({ text });
        return { success: true, text, data: { payment_required: true, accepts: data.accepts } };
      }

      const result = data as ContentResponse;

      // Truncate large content to prevent context bloat
      const displayContent = result.full_content.length > CONTENT_TRUNCATE_LEN
        ? result.full_content.slice(0, CONTENT_TRUNCATE_LEN) + `\n... [truncated, ${result.full_content.length} chars total]`
        : result.full_content;

      const text = result.file_url
        ? `Content retrieved (id: ${knowledgeId}).\n\n${displayContent}\n\nFile: ${result.file_url}`
        : `Content retrieved (id: ${knowledgeId}).\n\n${displayContent}`;

      if (callback) await callback({ text });

      // Return truncated content in data to prevent context bloat in action chaining
      const truncatedResult: ContentResponse = {
        full_content: result.full_content.length > CONTENT_TRUNCATE_LEN
          ? result.full_content.slice(0, CONTENT_TRUNCATE_LEN)
          : result.full_content,
        file_url: result.file_url,
      };
      return { success: true, text, data: { content: truncatedResult } };
    } catch (e) {
      const msg = e instanceof KmApiError
        ? `KnowMint API Error (${e.status ?? "unknown"}): ${e.message}`
        : `Error retrieving content: ${(e as Error).message}`;

      if (callback) await callback({ text: msg });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      {
        name: "user",
        content: {
          text: "Get the content for knowledge item abc123",
          knowledge_id: "abc123",
        },
      },
      {
        name: "assistant",
        content: {
          text: "I'll retrieve the full content from KnowMint.",
          actions: ["GET_CONTENT"],
        },
      },
    ],
    [
      {
        name: "user",
        content: {
          text: "Retry with payment proof",
          knowledge_id: "abc123",
          payment_proof: "eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJzb2xhbmE6bWFpbm5ldCJ9",
        },
      },
      {
        name: "assistant",
        content: {
          text: "I'll retry with the payment proof.",
          actions: ["GET_CONTENT"],
        },
      },
    ],
  ],
};
