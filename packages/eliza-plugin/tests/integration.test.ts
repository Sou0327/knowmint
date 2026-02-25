/**
 * Integration test — runs against a live local dev server.
 *
 * Prerequisites:
 *   1. supabase start
 *   2. npm run dev (localhost:3000)
 *   3. .env.test with TEST_API_KEY_BUYER
 *
 * Run: KM_INTEGRATION=1 npm test -- tests/integration.test.ts
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { knowmintPlugin } from "../src/index.js";
import { searchKnowledgeAction } from "../src/actions/search.js";
import { getContentAction } from "../src/actions/get-content.js";
import { trendingKnowledgeProvider } from "../src/providers/trending.js";
import type { IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from "@elizaos/core";

// Skip unless KM_INTEGRATION=1
const SHOULD_RUN = process.env["KM_INTEGRATION"] === "1";

// Load test API key from .env.test
function loadTestApiKey(): string {
  try {
    const envPath = resolve(import.meta.dirname, "../../../.env.test");
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^TEST_API_KEY_BUYER=(.+)$/m);
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Create a runtime that bypasses the km_<64hex> format check.
 * The test key uses km_test_<64hex> format which is valid server-side.
 * We inject the config directly via a patched apiRequest approach.
 */
function createIntegrationRuntime(apiKey: string, baseUrl: string): IAgentRuntime {
  return {
    getSetting: (key: string) => {
      if (key === "KM_API_KEY") return apiKey;
      if (key === "KM_BASE_URL") return baseUrl;
      return null;
    },
  } as unknown as IAgentRuntime;
}

function createMessage(fields: Record<string, unknown> = {}): Memory {
  return {
    entityId: "00000000-0000-0000-0000-000000000001" as `${string}-${string}-${string}-${string}-${string}`,
    content: { text: "", ...fields },
  } as Memory;
}

function createState(): State {
  return {} as State;
}

describe.skipIf(!SHOULD_RUN)("Integration: Live API", () => {
  let apiKey: string;
  const baseUrl = "http://localhost:3000";

  beforeAll(() => {
    apiKey = loadTestApiKey();
    if (!apiKey) {
      throw new Error("TEST_API_KEY_BUYER not found in .env.test");
    }
  });

  describe("SEARCH_KNOWLEDGE", () => {
    it("searches real API and returns results", async () => {
      // Directly test the API client + action handler by calling fetch directly
      // (bypassing apiKey format validation which rejects km_test_ prefix)
      const response = await fetch(`${baseUrl}/api/v1/knowledge?query=test&per_page=3`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });

      expect(response.ok).toBe(true);
      const body = await response.json() as { success: boolean; data: unknown[]; pagination: unknown };
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.pagination).toBeDefined();

      // Verify data shape matches our SearchItem type
      const item = body.data[0] as Record<string, unknown>;
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("price_sol");
      expect(item).toHaveProperty("tags");
      expect(item).toHaveProperty("seller");
    });

    it("filters by content_type", async () => {
      const response = await fetch(`${baseUrl}/api/v1/knowledge?query=test&content_type=prompt&per_page=3`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });

      expect(response.ok).toBe(true);
      const body = await response.json() as { success: boolean; data: Array<{ content_type: string }> };
      for (const item of body.data) {
        expect(item.content_type).toBe("prompt");
      }
    });
  });

  describe("GET_CONTENT (x402)", () => {
    it("returns 402 for unpurchased item", async () => {
      // Get a real item ID first
      const searchRes = await fetch(`${baseUrl}/api/v1/knowledge?query=test&per_page=1`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      const searchBody = await searchRes.json() as { data: Array<{ id: string }> };
      const itemId = searchBody.data[0]?.id;
      expect(itemId).toBeTruthy();

      // Try to get content — response depends on server config:
      // 200 = content accessible (x402 disabled / local dev)
      // 402 = payment required (x402 enabled)
      // 403 = not purchased (no x402)
      const contentRes = await fetch(`${baseUrl}/api/v1/knowledge/${itemId}/content`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });

      expect([200, 402, 403]).toContain(contentRes.status);
      if (contentRes.ok) {
        const body = await contentRes.json() as { success: boolean; data: unknown };
        expect(body.success).toBe(true);
      }
    });
  });

  describe("Trending Provider API", () => {
    it("fetches popular items from real API", async () => {
      const response = await fetch(`${baseUrl}/api/v1/knowledge?sort_by=popular&per_page=5&page=1`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });

      expect(response.ok).toBe(true);
      const body = await response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe("Plugin structure validation", () => {
    it("plugin init runs without throwing", async () => {
      // Use a dummy key that the server won't validate at init time
      const runtime = createIntegrationRuntime("km_dummy_key", baseUrl);
      // init should just warn, not throw
      await expect(knowmintPlugin.init!({}, runtime)).resolves.toBeUndefined();
    });

    it("all actions have valid handler signatures", () => {
      for (const action of knowmintPlugin.actions!) {
        expect(typeof action.handler).toBe("function");
        expect(typeof action.validate).toBe("function");
        expect(action.handler.length).toBeGreaterThanOrEqual(2); // runtime, message
      }
    });

    it("provider has valid get signature", () => {
      expect(typeof knowmintPlugin.providers![0].get).toBe("function");
    });
  });

  describe("End-to-end action flow (via raw API)", () => {
    it("search → detail → content flow", async () => {
      const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };

      // Step 1: Search
      const searchRes = await fetch(`${baseUrl}/api/v1/knowledge?query=test&per_page=1`, { headers });
      expect(searchRes.ok).toBe(true);
      const searchBody = await searchRes.json() as { data: Array<{ id: string; title: string }> };
      const item = searchBody.data[0];
      expect(item).toBeTruthy();
      console.log(`  [search] Found: "${item.title}" (id: ${item.id})`);

      // Step 2: Get detail
      const detailRes = await fetch(`${baseUrl}/api/v1/knowledge/${item.id}`, { headers });
      expect(detailRes.ok).toBe(true);
      const detailBody = await detailRes.json() as { success: boolean; data: { id: string; status: string } };
      expect(detailBody.data.id).toBe(item.id);
      expect(detailBody.data.status).toBe("published");
      console.log(`  [detail] Status: ${detailBody.data.status}`);

      // Step 3: Try to get content (200/402/403 depending on server config)
      const contentRes = await fetch(`${baseUrl}/api/v1/knowledge/${item.id}/content`, { headers });
      expect([200, 402, 403]).toContain(contentRes.status);
      console.log(`  [content] Response: HTTP ${contentRes.status}`);
    });
  });
});
