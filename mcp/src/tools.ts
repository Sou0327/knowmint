import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  apiRequest,
  apiRequestPaginated,
  apiRequestWithPayment,
  createAndPublishKnowledge,
  KmApiError,
} from "./api.ts";
import type { KmConfig } from "./api.ts";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** 知識 ID の形式バリデーション (UUID / CUID / 数字 ID に対応) */
const knowledgeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "knowledge_id must be alphanumeric (no slashes or special chars)");

function ok(data: unknown): ToolResult {
  // compact JSON でオーバーヘッドを抑える
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function err(e: unknown): ToolResult {
  const msg =
    e instanceof KmApiError
      ? `API Error (${e.status ?? "unknown"}): ${e.message}`
      : `Error: ${(e as Error).message ?? String(e)}`;
  return { content: [{ type: "text", text: msg }], isError: true };
}

type SearchItem = {
  id?: string;
  title?: string;
  usefulness_score?: number | null;
  tags?: string[];
  metadata?: {
    domain?: string;
    experience_type?: string;
    source_type?: string;
    applicable_to?: string[];
  } | null;
  seller?: {
    trust_score?: number | null;
  };
  [key: string]: unknown;
};

function formatSearchResults(result: { data: unknown[]; pagination: unknown }): string {
  const lines: string[] = [];
  for (const item of result.data as SearchItem[]) {
    const score = item.usefulness_score != null
      ? `[品質スコア: ${item.usefulness_score.toFixed(2)}] `
      : "";
    const trustScore = item.seller?.trust_score != null
      ? `[信頼度: ${item.seller.trust_score.toFixed(2)}] `
      : "";
    lines.push(`${score}${trustScore}${item.title ?? "(no title)"} (id: ${item.id ?? "?"})`);
    if (item.tags && item.tags.length > 0) {
      lines.push(`  タグ: ${item.tags.map((t) => `#${t}`).join(" ")}`);
    }
    if (item.metadata) {
      const m = item.metadata;
      const parts: string[] = [];
      if (m.domain) parts.push(`ドメイン=${m.domain}`);
      if (m.experience_type) parts.push(`経験タイプ=${m.experience_type}`);
      if (m.source_type) parts.push(`ソース=${m.source_type}`);
      if (m.applicable_to && m.applicable_to.length > 0) {
        parts.push(`対応AI=${m.applicable_to.join(",")}`);
      }
      if (parts.length > 0) lines.push(`  メタデータ: ${parts.join(", ")}`);
    }
  }
  const summary = `${result.data.length}件の結果\n${lines.join("\n")}`;
  return summary;
}

export function registerTools(server: McpServer, config: KmConfig): void {
  // ── km_search ────────────────────────────────────────────────────────────
  server.tool(
    "km_search",
    "Search knowledge items in the Knowledge Market. Returns a list of items with title, description, price, and metadata.",
    {
      query: z.string().min(1).max(200).describe("Search query"),
      content_type: z
        .enum(["prompt", "tool_def", "dataset", "api", "general"])
        .optional()
        .describe("Filter by content type"),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum number of results (default: 20)"),
      metadata_domain: z
        .enum(["finance", "engineering", "marketing", "legal", "medical", "education", "other"])
        .optional()
        .describe("ドメインフィルタ"),
      metadata_experience_type: z
        .enum(["case_study", "how_to", "template", "checklist", "reference", "other"])
        .optional()
        .describe("経験タイプフィルタ"),
      metadata_source_type: z
        .enum(["personal_experience", "research", "industry_standard", "other"])
        .optional()
        .describe("情報ソースフィルタ"),
      sort_by: z
        .enum(["newest", "popular", "price_low", "price_high", "rating", "trust_score"])
        .optional()
        .describe("ソート順 (デフォルト: newest)"),
    },
    async ({ query, content_type, max_results, metadata_domain, metadata_experience_type, metadata_source_type, sort_by }) => {
      try {
        const params = new URLSearchParams({
          query,
          page: "1",
          per_page: String(max_results ?? 20),
        });
        if (content_type) params.set("content_type", content_type);
        if (metadata_domain) params.set("metadata_domain", metadata_domain);
        if (metadata_experience_type) params.set("metadata_experience_type", metadata_experience_type);
        if (metadata_source_type) params.set("metadata_source_type", metadata_source_type);
        if (sort_by) params.set("sort_by", sort_by);
        const result = await apiRequestPaginated<unknown>(
          config,
          `/api/v1/knowledge?${params.toString()}`
        );
        return { content: [{ type: "text", text: formatSearchResults(result) }] };
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── km_get_detail ─────────────────────────────────────────────────────────
  server.tool(
    "km_get_detail",
    "Get details and preview content for a knowledge item. Use this to evaluate a purchase before buying.",
    {
      knowledge_id: knowledgeIdSchema.describe("Knowledge item ID"),
    },
    async ({ knowledge_id }) => {
      try {
        const data = await apiRequest<unknown>(
          config,
          `/api/v1/knowledge/${encodeURIComponent(knowledge_id)}`
        );
        return ok(data);
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── km_purchase ───────────────────────────────────────────────────────────
  server.tool(
    "km_purchase",
    "Record a purchase after sending payment on-chain. Submit the transaction hash to unlock content access.",
    {
      knowledge_id: knowledgeIdSchema.describe("Knowledge item ID to purchase"),
      tx_hash: z
        .string()
        .min(1)
        .max(256)
        .describe("On-chain transaction hash of the payment"),
      token: z
        .enum(["SOL", "USDC"])
        .optional()
        .describe("Token used for payment (default: SOL)"),
      chain: z
        .string()
        .max(64)
        .optional()
        .describe("Blockchain used (default: solana)"),
    },
    async ({ knowledge_id, tx_hash, token, chain }) => {
      try {
        const data = await apiRequest<unknown>(
          config,
          `/api/v1/knowledge/${encodeURIComponent(knowledge_id)}/purchase`,
          "POST",
          {
            tx_hash,
            token: token ?? "SOL",
            chain: chain ?? "solana",
          }
        );
        return ok(data);
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── km_get_content ────────────────────────────────────────────────────────
  server.tool(
    "km_get_content",
    "Retrieve the full content of a knowledge item. If payment_required: true is returned, send on-chain payment and retry with payment_proof (base64-encoded X-PAYMENT).",
    {
      knowledge_id: knowledgeIdSchema.describe("Knowledge item ID"),
      payment_proof: z
        .string()
        .optional()
        .describe(
          "base64-encoded X-PAYMENT proof. Format: base64({scheme,network,payload:{txHash,asset?}}). Obtain after sending on-chain payment and retry."
        ),
    },
    async ({ knowledge_id, payment_proof }) => {
      try {
        const extraHeaders = payment_proof
          ? { "X-PAYMENT": payment_proof }
          : undefined;
        const data = await apiRequestWithPayment<unknown>(
          config,
          `/api/v1/knowledge/${encodeURIComponent(knowledge_id)}/content`,
          extraHeaders
        );
        return ok(data);
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── km_get_version_history ────────────────────────────────────────────────
  server.tool(
    "km_get_version_history",
    "Get version history of a knowledge item. Shows past snapshots of changes.",
    {
      knowledge_id: knowledgeIdSchema.describe("Knowledge item ID"),
      page: z.number().int().min(1).default(1).describe("Page number (default: 1)"),
      per_page: z.number().int().min(1).max(100).default(20).describe("Items per page (default: 20, max: 100)"),
    },
    async ({ knowledge_id, page, per_page }) => {
      try {
        const qs = new URLSearchParams({ page: String(page), per_page: String(per_page) });
        const result = await apiRequestPaginated<unknown>(
          config,
          `/api/v1/knowledge/${encodeURIComponent(knowledge_id)}/versions?${qs.toString()}`
        );
        return ok(result);
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── km_publish ────────────────────────────────────────────────────────────
  server.tool(
    "km_publish",
    "Create and publish a new knowledge item in one step. Either price_sol or price_usdc must be specified.",
    {
      title: z.string().min(1).max(200).describe("Title of the knowledge item"),
      description: z.string().min(1).max(2000).describe("Description of the knowledge item"),
      content_type: z
        .enum(["prompt", "tool_def", "dataset", "api", "general"])
        .describe("Type of knowledge content"),
      content: z.string().min(1).describe("Full content to publish"),
      price_sol: z
        .number()
        .positive()
        .optional()
        .describe("Price in SOL (specify price_sol or price_usdc)"),
      price_usdc: z
        .number()
        .positive()
        .optional()
        .describe("Price in USDC (specify price_sol or price_usdc)"),
      tags: z
        .array(z.string().max(50))
        .max(10)
        .optional()
        .describe("Tags for discoverability (max 10)"),
    },
    async ({ title, description, content_type, content, price_sol, price_usdc, tags }) => {
      if (price_sol == null && price_usdc == null) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Either price_sol or price_usdc must be specified.",
            },
          ],
          isError: true,
        };
      }

      try {
        const data = await createAndPublishKnowledge(config, {
          title,
          description,
          content_type,
          content,
          price_sol,
          price_usdc,
          tags,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    }
  );
}
