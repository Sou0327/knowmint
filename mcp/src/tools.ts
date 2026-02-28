import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  apiRequest,
  apiRequestPaginated,
  apiRequestPublic,
  apiRequestWithPayment,
  createAndPublishKnowledge,
  saveConfig,
  KmApiError,
} from "./api.ts";
import type { KmConfig } from "./api.ts";
import { PublicKey } from "@solana/web3.js";

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
    "Search knowledge items in KnowMint. Returns a list of items with title, description, price, and metadata.",
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

  // ── km_register ──────────────────────────────────────────────────────────
  server.tool(
    "km_register",
    "Register a new KnowMint account using a Solana keypair. Creates an account and returns an API key for autonomous operations. Run this before using other tools if no API key is configured.",
    {
      keypair_path: z.string().describe("Path to Solana keypair JSON file (64-byte array)"),
      display_name: z.string().max(100).optional().describe("Display name for the new account"),
      base_url: z.string().optional().describe("KnowMint API base URL override"),
    },
    async ({ keypair_path, display_name, base_url }) => {
      try {
        const baseUrl = base_url ? validateToolBaseUrl(base_url) : config.baseUrl;

        // Load keypair
        const { secretKey, wallet } = await loadKeypairFromFile(keypair_path);

        // 1. Challenge
        type ChallengeResp = { nonce: string; message: string; expires_at: string };
        const challenge = await apiRequestPublic<ChallengeResp>(
          baseUrl, "/api/v1/auth/challenge", "POST",
          { wallet, purpose: "register" }
        );

        // 2. Validate message + Sign
        validateChallengeMessage(challenge.message, wallet, challenge.nonce, "register");
        const { ed25519 } = await import("@noble/curves/ed25519");
        const messageBytes = new TextEncoder().encode(challenge.message);
        const sigBytes = ed25519.sign(messageBytes, secretKey);
        const signature = Buffer.from(sigBytes).toString("hex");

        // 3. Register
        type RegisterResp = { api_key: string; user_id: string; wallet: string };
        const result = await apiRequestPublic<RegisterResp>(
          baseUrl, "/api/v1/auth/register", "POST",
          { wallet, signature, nonce: challenge.nonce, display_name }
        );

        // 4. Update in-memory config + persist
        config.apiKey = result.api_key;
        config.baseUrl = baseUrl;
        await saveConfig(config);

        return ok({
          status: "registered",
          user_id: result.user_id,
          wallet: result.wallet,
          api_key_configured: true,
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── km_wallet_login ──────────────────────────────────────────────────────
  server.tool(
    "km_wallet_login",
    "Log in to an existing KnowMint account using a Solana keypair. Returns a new API key. Use this if you already registered but need a fresh key.",
    {
      keypair_path: z.string().describe("Path to Solana keypair JSON file (64-byte array)"),
      key_name: z.string().max(100).optional().describe("Name for the new API key"),
      base_url: z.string().optional().describe("KnowMint API base URL override"),
    },
    async ({ keypair_path, key_name, base_url }) => {
      try {
        const baseUrl = base_url ? validateToolBaseUrl(base_url) : config.baseUrl;

        // Load keypair
        const { secretKey, wallet } = await loadKeypairFromFile(keypair_path);

        // 1. Challenge
        type ChallengeResp = { nonce: string; message: string; expires_at: string };
        const challenge = await apiRequestPublic<ChallengeResp>(
          baseUrl, "/api/v1/auth/challenge", "POST",
          { wallet, purpose: "login" }
        );

        // 2. Validate message + Sign
        validateChallengeMessage(challenge.message, wallet, challenge.nonce, "login");
        const { ed25519 } = await import("@noble/curves/ed25519");
        const messageBytes = new TextEncoder().encode(challenge.message);
        const sigBytes = ed25519.sign(messageBytes, secretKey);
        const signature = Buffer.from(sigBytes).toString("hex");

        // 3. Login
        type LoginResp = { api_key: string; user_id: string; wallet: string };
        const result = await apiRequestPublic<LoginResp>(
          baseUrl, "/api/v1/auth/login", "POST",
          { wallet, signature, nonce: challenge.nonce, key_name }
        );

        // 4. Update in-memory config + persist
        config.apiKey = result.api_key;
        config.baseUrl = baseUrl;
        await saveConfig(config);

        return ok({
          status: "logged_in",
          user_id: result.user_id,
          wallet: result.wallet,
          api_key_configured: true,
        });
      } catch (e) {
        return err(e);
      }
    }
  );
}

// ── Message validation (署名オラクル防止) ───────────────────────────────────

/**
 * サーバーから返されたチャレンジメッセージが期待するフォーマットと完全一致するか検証。
 * buildAuthMessage (サーバー側 src/lib/siws/auth-message.ts) と同一テンプレートを
 * クライアント側で再構築し、完全一致で検証することで署名オラクル攻撃を防止する。
 *
 * IMPORTANT: テンプレート変更時は src/lib/siws/auth-message.ts と cli/bin/km.mjs も同期すること。
 */
function validateChallengeMessage(
  message: string,
  wallet: string,
  nonce: string,
  purpose: "register" | "login"
): void {
  const action = purpose === "register"
    ? "register a new account with"
    : "log in with";
  const expected = [
    `KnowMint wants you to ${action} your Solana wallet.`,
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    "",
    "By signing this message you confirm that you own this wallet.",
    "This request does not involve any transaction or transfer of funds.",
  ].join("\n");

  if (message !== expected) {
    throw new Error(
      "Challenge message does not match expected format. " +
      "Server may be compromised or incompatible."
    );
  }
}

// ── Base URL validation (SSRF 防止) ─────────────────────────────────────────

function validateToolBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`Invalid base URL: "${raw}"`);
  }
  if (parsed.username || parsed.password) {
    throw new Error("Base URL must not contain credentials");
  }
  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1" ||
    parsed.hostname === "[::1]";
  if (!isLocal && parsed.protocol !== "https:") {
    throw new Error("Base URL must use HTTPS for non-localhost hosts");
  }
  return parsed.origin;
}

// ── Keypair helper ──────────────────────────────────────────────────────────

async function loadKeypairFromFile(
  keypairPath: string
): Promise<{ secretKey: Uint8Array; publicKeyBytes: Uint8Array; wallet: string }> {
  const resolved = keypairPath.startsWith("~")
    ? path.join(os.homedir(), keypairPath.slice(1))
    : path.resolve(keypairPath);

  let raw: string;
  try {
    raw = await fs.readFile(resolved, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Keypair file not found: ${resolved}. ` +
        `Generate one with: solana-keygen new --outfile ${resolved}`
      );
    }
    throw e;
  }

  const arr = JSON.parse(raw) as number[];
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error(`Invalid keypair file (expected 64-byte JSON array): ${resolved}`);
  }
  // 各要素が 0..255 の整数であることを検証
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 255) {
      throw new Error(`Invalid byte at index ${i} in keypair file: ${resolved}`);
    }
  }

  const bytes = new Uint8Array(arr);
  const secretKey = bytes.slice(0, 32);
  const publicKeyBytes = bytes.slice(32, 64);

  // secret key から導出した public key と格納値の整合性を検証
  const { ed25519: ed } = await import("@noble/curves/ed25519");
  const derivedPub = ed.getPublicKey(secretKey);
  // @solana/web3.js の PublicKey.toBase58() で Base58 エンコード (重複実装を排除)
  const derivedWallet = new PublicKey(new Uint8Array(derivedPub)).toBase58();
  const storedWallet = new PublicKey(publicKeyBytes).toBase58();
  if (derivedWallet !== storedWallet) {
    throw new Error(`Keypair integrity check failed (public key mismatch): ${resolved}`);
  }

  return {
    secretKey,
    publicKeyBytes,
    wallet: storedWallet,
  };
}
