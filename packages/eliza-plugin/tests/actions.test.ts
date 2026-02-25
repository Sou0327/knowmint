import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchKnowledgeAction } from "../src/actions/search.js";
import { purchaseKnowledgeAction } from "../src/actions/purchase.js";
import { getContentAction } from "../src/actions/get-content.js";
import {
  createMockRuntime,
  createMessage,
  createState,
  mockResponse,
  TEST_API_KEY,
  TEST_BASE_URL,
  TEST_SETTINGS,
} from "./helpers.js";
import type { HandlerCallback } from "@elizaos/core";

describe("actions", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── SEARCH_KNOWLEDGE ──────────────────────────────────

  describe("SEARCH_KNOWLEDGE", () => {
    it("validate returns false without API key", async () => {
      const runtime = createMockRuntime({});
      const result = await searchKnowledgeAction.validate(runtime, createMessage());
      expect(result).toBe(false);
    });

    it("validate returns true with API key", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const result = await searchKnowledgeAction.validate(runtime, createMessage());
      expect(result).toBe(true);
    });

    it("handler returns error for empty query", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();

      const result = await searchKnowledgeAction.handler(
        runtime, createMessage({ text: "" }), createState(), {}, callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false }));
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining("search query") }),
      );
    });

    it("handler searches and returns formatted results", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          success: true,
          data: [
            {
              id: "item-1",
              title: "Solana MEV Guide",
              price_sol: 0.5,
              price_usdc: null,
              tags: ["solana", "mev"],
              usefulness_score: 4.2,
              metadata: { domain: "finance" },
              seller: { trust_score: 0.95 },
            },
          ],
          pagination: { page: 1, total: 1 },
        }),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await searchKnowledgeAction.handler(
        runtime, createMessage({ text: "Solana MEV" }), createState(), {}, callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(callback).toHaveBeenCalledOnce();
      const text = callback.mock.calls[0][0].text;
      expect(text).toContain("Solana MEV Guide");
      expect(text).toContain("item-1");
      expect(text).toContain("0.5 SOL");
      expect(text).toContain("#solana");

      // Verify API was called with correct params
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("/api/v1/knowledge?");
      expect(url).toContain("query=Solana+MEV");
    });

    it("handler caps query length to 200", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ success: true, data: [], pagination: { page: 1 } }),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      const longQuery = "a".repeat(300);
      await searchKnowledgeAction.handler(
        runtime, createMessage({ text: longQuery }), createState(), {},
      );

      const [url] = fetchSpy.mock.calls[0];
      const queryParam = new URL(url).searchParams.get("query")!;
      expect(queryParam.length).toBeLessThanOrEqual(200);
    });

    it("handler validates content_type and sort_by", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ success: true, data: [], pagination: {} }),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      await searchKnowledgeAction.handler(
        runtime,
        createMessage({ text: "test" }),
        createState(),
        { content_type: "prompt", sort_by: "popular", max_results: 5 },
      );

      const [url] = fetchSpy.mock.calls[0];
      const params = new URL(url).searchParams;
      expect(params.get("content_type")).toBe("prompt");
      expect(params.get("sort_by")).toBe("popular");
      expect(params.get("per_page")).toBe("5");
    });

    it("handler ignores invalid content_type", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ success: true, data: [], pagination: {} }),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      await searchKnowledgeAction.handler(
        runtime,
        createMessage({ text: "test" }),
        createState(),
        { content_type: "INVALID" },
      );

      const [url] = fetchSpy.mock.calls[0];
      expect(new URL(url).searchParams.has("content_type")).toBe(false);
    });
  });

  // ── PURCHASE_KNOWLEDGE ──────────────────────────────────

  describe("PURCHASE_KNOWLEDGE", () => {
    it("handler returns error for missing knowledge_id", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await purchaseKnowledgeAction.handler(
        runtime, createMessage({}), createState(), { tx_hash: "abc123" }, callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("knowledge_id") }));
    });

    it("handler returns error for invalid knowledge_id format", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await purchaseKnowledgeAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "../etc/passwd", tx_hash: "abc" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("Invalid knowledge_id") }));
    });

    it("handler returns error for missing tx_hash", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await purchaseKnowledgeAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("tx_hash") }));
    });

    it("handler returns error for invalid tx_hash format", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await purchaseKnowledgeAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1", tx_hash: "invalid/hash!@#" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("Invalid tx_hash") }));
    });

    it("handler returns error for invalid token", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await purchaseKnowledgeAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1", tx_hash: "abc123", token: "ETH" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("Invalid token") }));
    });

    it("handler returns error for invalid chain", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await purchaseKnowledgeAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1", tx_hash: "abc123", chain: "ethereum" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("Invalid chain") }));
    });

    it("handler returns error for non-string token", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await purchaseKnowledgeAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1", tx_hash: "abc123", token: 42 },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("must be a string") }));
    });

    it("handler records purchase successfully", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          success: true,
          data: {
            id: "purchase-1",
            buyer_id: "buyer",
            seller_id: "seller",
            knowledge_item_id: "item-1",
            amount: 0.5,
            token: "SOL",
            chain: "solana",
            tx_hash: "5xYz123abc",
            status: "confirmed",
          },
        }),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await purchaseKnowledgeAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1", tx_hash: "5xYz123abc" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      const text = callback.mock.calls[0][0].text;
      expect(text).toContain("Purchase recorded successfully");
      expect(text).toContain("0.5 SOL");

      // Verify API call
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain("/api/v1/knowledge/item-1/purchase");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body.tx_hash).toBe("5xYz123abc");
      expect(body.token).toBe("SOL");
      expect(body.chain).toBe("solana");
    });
  });

  // ── GET_CONTENT ──────────────────────────────────

  describe("GET_CONTENT", () => {
    it("handler returns content on success", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          success: true,
          data: { full_content: "Secret knowledge here", file_url: null },
        }),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await getContentAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      const text = callback.mock.calls[0][0].text;
      expect(text).toContain("Content retrieved");
      expect(text).toContain("Secret knowledge here");
    });

    it("handler returns payment required on 402", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse(
          { x402Version: 1, accepts: [{ scheme: "exact" }], error: "Purchase required" },
          402,
        ),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await getContentAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ payment_required: true }),
      }));
      const text = callback.mock.calls[0][0].text;
      expect(text).toContain("Payment required");
    });

    it("handler validates payment_proof format", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await getContentAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1", payment_proof: "not<valid>base64" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("base64") }));
    });

    it("handler rejects oversized payment_proof", async () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await getContentAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1", payment_proof: "A".repeat(5000) },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining("too long") }));
    });

    it("handler sends X-PAYMENT header with valid proof", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ success: true, data: { full_content: "paid content", file_url: null } }),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      const proof = "eyJzY2hlbWUiOiJleGFjdCJ9";
      await getContentAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1", payment_proof: proof },
      );

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers["X-PAYMENT"]).toBe(proof);
    });

    it("handler truncates large content", async () => {
      const largeContent = "X".repeat(20000);
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          success: true,
          data: { full_content: largeContent, file_url: null },
        }),
      );

      const runtime = createMockRuntime(TEST_SETTINGS);
      const callback = vi.fn();
      const result = await getContentAction.handler(
        runtime, createMessage({}), createState(),
        { knowledge_id: "item-1" },
        callback as unknown as HandlerCallback,
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      const text = callback.mock.calls[0][0].text;
      expect(text).toContain("[truncated");
      expect(text.length).toBeLessThan(largeContent.length);

      // data.content should also be truncated
      const data = (result as { data: { content: { full_content: string } } }).data;
      expect(data.content.full_content.length).toBeLessThanOrEqual(8000);
    });
  });
});
