import {
  ActionProvider,
  CreateAction,
  type WalletProvider,
  type Network,
} from "@coinbase/agentkit";
import { z } from "zod";

import type { KnowMintConfig, PaymentRequiredResponse } from "./types.js";
import { KmApiClient, KmApiError } from "./api.js";
import {
  KmSearchSchema,
  KmGetDetailSchema,
  KmPurchaseSchema,
  KmGetContentSchema,
  KmPublishSchema,
} from "./schemas.js";

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
    const score =
      typeof item.usefulness_score === "number"
        ? `[Quality: ${item.usefulness_score.toFixed(2)}] `
        : "";
    const trustScore =
      typeof item.seller?.trust_score === "number"
        ? `[Trust: ${item.seller.trust_score.toFixed(2)}] `
        : "";
    const title = sanitizeField(item.title ?? "(no title)");
    const id = sanitizeField(item.id ?? "?");
    lines.push(`${score}${trustScore}${title} (id: ${id})`);
    if (Array.isArray(item.tags) && item.tags.length > 0) {
      lines.push(`  Tags: ${item.tags.map((t: unknown) => `#${sanitizeField(t)}`).join(" ")}`);
    }
    if (item.metadata && typeof item.metadata === "object") {
      const m = item.metadata;
      const parts: string[] = [];
      if (m.domain) parts.push(`domain=${sanitizeField(m.domain)}`);
      if (m.experience_type) parts.push(`type=${sanitizeField(m.experience_type)}`);
      if (m.source_type) parts.push(`source=${sanitizeField(m.source_type)}`);
      if (Array.isArray(m.applicable_to) && m.applicable_to.length > 0) {
        parts.push(`ai=${m.applicable_to.map((v: unknown) => sanitizeField(v)).join(",")}`);
      }
      if (parts.length > 0) lines.push(`  Metadata: ${parts.join(", ")}`);
    }
  }
  return `${result.data.length} results\n${lines.join("\n")}`;
}

/** Strip control characters and newlines from untrusted values */
function sanitizeField(raw: unknown): string {
  const str = typeof raw === "string" ? raw : String(raw ?? "");
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 256);
}

function formatError(e: unknown): string {
  if (e instanceof KmApiError) {
    return `API Error (${e.status ?? "unknown"}): ${e.message}`;
  }
  return `Error: ${(e as Error).message ?? String(e)}`;
}

function isPaymentRequired(v: unknown): v is PaymentRequiredResponse {
  return (
    v != null &&
    typeof v === "object" &&
    (v as PaymentRequiredResponse).payment_required === true
  );
}

class KnowMintActionProvider extends ActionProvider<WalletProvider> {
  private readonly api: KmApiClient;

  constructor(config: KnowMintConfig) {
    super("knowmint", []);
    this.api = new KmApiClient(config);
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "svm";

  @CreateAction({
    name: "km_search",
    description:
      "Search knowledge items in KnowMint marketplace. Returns a list of items with title, quality score, trust score, tags, and metadata.",
    schema: KmSearchSchema,
  })
  async kmSearch(
    _walletProvider: WalletProvider,
    args: z.infer<typeof KmSearchSchema>
  ): Promise<string> {
    try {
      const params = new URLSearchParams({
        query: args.query,
        page: "1",
        per_page: String(args.max_results ?? 20),
      });
      if (args.content_type) params.set("content_type", args.content_type);
      if (args.metadata_domain) params.set("metadata_domain", args.metadata_domain);
      if (args.metadata_experience_type)
        params.set("metadata_experience_type", args.metadata_experience_type);
      if (args.metadata_source_type)
        params.set("metadata_source_type", args.metadata_source_type);
      if (args.sort_by) params.set("sort_by", args.sort_by);

      const result = await this.api.getPaginated<unknown>(
        `/api/v1/knowledge?${params.toString()}`
      );
      return formatSearchResults(result);
    } catch (e) {
      return formatError(e);
    }
  }

  @CreateAction({
    name: "km_get_detail",
    description:
      "Get details and preview content for a knowledge item. Use this to evaluate before purchasing.",
    schema: KmGetDetailSchema,
  })
  async kmGetDetail(
    _walletProvider: WalletProvider,
    args: z.infer<typeof KmGetDetailSchema>
  ): Promise<string> {
    try {
      const data = await this.api.get<unknown>(
        `/api/v1/knowledge/${encodeURIComponent(args.knowledge_id)}`
      );
      return JSON.stringify(data);
    } catch (e) {
      return formatError(e);
    }
  }

  @CreateAction({
    name: "km_purchase",
    description:
      "Record a purchase after sending payment on-chain. Submit the transaction hash to unlock content access.",
    schema: KmPurchaseSchema,
  })
  async kmPurchase(
    _walletProvider: WalletProvider,
    args: z.infer<typeof KmPurchaseSchema>
  ): Promise<string> {
    try {
      const data = await this.api.post<unknown>(
        `/api/v1/knowledge/${encodeURIComponent(args.knowledge_id)}/purchase`,
        {
          tx_hash: args.tx_hash,
          token: args.token ?? "SOL",
          chain: args.chain ?? "solana",
        }
      );
      return JSON.stringify(data);
    } catch (e) {
      return formatError(e);
    }
  }

  @CreateAction({
    name: "km_get_content",
    description:
      "Retrieve the full content of a knowledge item. If payment is required, returns payment instructions with payTo address and amount. After sending on-chain payment, retry with payment_proof.",
    schema: KmGetContentSchema,
  })
  async kmGetContent(
    _walletProvider: WalletProvider,
    args: z.infer<typeof KmGetContentSchema>
  ): Promise<string> {
    try {
      const extraHeaders = args.payment_proof
        ? { "X-PAYMENT": args.payment_proof }
        : undefined;

      const data = await this.api.getWithPayment<unknown>(
        `/api/v1/knowledge/${encodeURIComponent(args.knowledge_id)}/content`,
        extraHeaders
      );

      if (isPaymentRequired(data)) {
        const accepts = data.accepts ?? [];
        const lines = [
          "Payment required to access this content.",
          "",
          "Payment options:",
        ];
        for (const accept of accepts) {
          const amount = sanitizeField(accept.maxAmountRequired);
          const isNative = accept.asset === "native";
          const asset = isNative ? "SOL (native)" : `token mint: ${sanitizeField(accept.asset)}`;
          const payTo = sanitizeField(accept.payTo);
          const decimalsHint = isNative ? "9 decimals (1 SOL = 1e9 lamports)" : "check token decimals";
          lines.push(`  - ${amount} atomic units of ${asset} to ${payTo} [${decimalsHint}]`);
        }
        lines.push(
          "",
          "Steps:",
          "1. Send the required amount to the payTo address using the appropriate transfer action",
          "2. Call km_purchase with the transaction hash",
          "3. Call km_get_content again to retrieve the full content"
        );
        return lines.join("\n");
      }

      return JSON.stringify(data);
    } catch (e) {
      return formatError(e);
    }
  }

  @CreateAction({
    name: "km_publish",
    description:
      "Create and publish a new knowledge item in one step. Either price_sol or price_usdc must be specified.",
    schema: KmPublishSchema,
  })
  async kmPublish(
    _walletProvider: WalletProvider,
    args: z.infer<typeof KmPublishSchema>
  ): Promise<string> {
    try {
      type CreatedItem = { id: string };
      const created = await this.api.post<CreatedItem>("/api/v1/knowledge", {
        title: args.title,
        description: args.description,
        content_type: args.content_type,
        full_content: args.content,
        preview_content: args.content.slice(0, 280),
        price_sol: args.price_sol ?? null,
        price_usdc: args.price_usdc ?? null,
        tags: args.tags ?? [],
      });

      const published = await this.api.post<unknown>(
        `/api/v1/knowledge/${encodeURIComponent(created.id)}/publish`
      );
      return JSON.stringify(published);
    } catch (e) {
      return formatError(e);
    }
  }
}

export const knowmintProvider = (config: KnowMintConfig) =>
  new KnowMintActionProvider(config);
