import { z } from "zod";

const knowledgeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "knowledge_id must be alphanumeric (no slashes or special chars)");

export const KmSearchSchema = z
  .object({
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
      .describe("Domain filter"),
    metadata_experience_type: z
      .enum(["case_study", "how_to", "template", "checklist", "reference", "other"])
      .optional()
      .describe("Experience type filter"),
    metadata_source_type: z
      .enum(["personal_experience", "research", "industry_standard", "other"])
      .optional()
      .describe("Source type filter"),
    sort_by: z
      .enum(["newest", "popular", "price_low", "price_high", "rating", "trust_score"])
      .optional()
      .describe("Sort order (default: newest)"),
  })
  .strip()
  .describe("Search knowledge items in KnowMint marketplace");

export const KmGetDetailSchema = z
  .object({
    knowledge_id: knowledgeIdSchema.describe("Knowledge item ID"),
  })
  .strip()
  .describe("Get details and preview content for a knowledge item");

export const KmPurchaseSchema = z
  .object({
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
  })
  .strip()
  .describe("Record a purchase after sending payment on-chain");

export const KmGetContentSchema = z
  .object({
    knowledge_id: knowledgeIdSchema.describe("Knowledge item ID"),
    payment_proof: z
      .string()
      .max(2048)
      .optional()
      .describe(
        "base64-encoded X-PAYMENT proof (max 2048 chars). Format: base64({scheme,network,payload:{txHash,asset?}}). Obtain after sending on-chain payment and retry."
      ),
  })
  .strip()
  .describe("Retrieve full content of a knowledge item (may require payment)");

export const KmPublishSchema = z
  .object({
    title: z.string().min(1).max(200).describe("Title of the knowledge item"),
    description: z.string().min(1).max(2000).describe("Description of the knowledge item"),
    content_type: z
      .enum(["prompt", "tool_def", "dataset", "api", "general"])
      .describe("Type of knowledge content"),
    content: z.string().min(1).describe("Full content to publish"),
    price_sol: z
      .number()
      .positive()
      .finite()
      .optional()
      .describe("Price in SOL (specify price_sol or price_usdc)"),
    price_usdc: z
      .number()
      .positive()
      .finite()
      .optional()
      .describe("Price in USDC (specify price_sol or price_usdc)"),
    tags: z
      .array(z.string().max(50))
      .max(10)
      .optional()
      .describe("Tags for discoverability (max 10)"),
  })
  .strip()
  .refine((d) => d.price_sol != null || d.price_usdc != null, {
    message: "Either price_sol or price_usdc must be specified",
  })
  .describe("Create and publish a new knowledge item");
