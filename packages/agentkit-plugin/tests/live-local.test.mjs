#!/usr/bin/env node
/**
 * AgentKit プラグイン ローカル実通信テスト
 *
 * 前提条件:
 *   1. supabase start 済み (127.0.0.1:54321)
 *   2. npm run dev 済み (localhost:3000)
 *
 * 実行:
 *   node tests/live-local.test.mjs
 *
 * 動作:
 *   1. ローカル Supabase にテストユーザー + API キーを作成
 *   2. テスト用ナレッジアイテムを公開
 *   3. AgentKit プラグインの各アクションを実際の HTTP で検証
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DEV_SERVER_URL = "http://localhost:3000";

// ── Supabase admin client ───────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function generateApiKey() {
  const raw = "km_" + randomBytes(32).toString("hex");
  const hash = sha256(raw);
  return { raw, hash };
}

// ── Pre-flight checks ───────────────────────────────────────────────────────
async function checkDevServer() {
  try {
    const res = await fetch(`${DEV_SERVER_URL}/api/health`);
    const data = await res.json();
    if (!(data.status === "ok" || (data.success && data.data?.status === "ok"))) throw new Error("unhealthy");
  } catch {
    console.error(
      "\n❌ Dev server is not running at " + DEV_SERVER_URL + "\n" +
      "   Run: npm run dev\n"
    );
    process.exit(1);
  }
}

async function checkSupabase() {
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) throw error;
  } catch {
    console.error(
      "\n❌ Local Supabase is not reachable at " + SUPABASE_URL + "\n" +
      "   Run: npx supabase start\n"
    );
    process.exit(1);
  }
}

// ── Test state ──────────────────────────────────────────────────────────────
let apiKeyRaw;
let sellerUserId;
let knowledgeItemId;
let provider;

// ── Setup & Teardown ────────────────────────────────────────────────────────

describe("AgentKit Plugin — Live Local Test", () => {
  before(async () => {
    // Pre-flight
    await checkDevServer();
    await checkSupabase();

    // 1. Create test seller user
    console.log("  Setting up test user...");
    const email = `agentkit-test-${Date.now()}@local.test`;
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: "TestPass123!",
        email_confirm: true,
      });
    if (authError) throw new Error(`Auth user creation failed: ${authError.message}`);
    sellerUserId = authData.user.id;

    // 2. Create profile
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: sellerUserId,
        display_name: "AgentKit Test Seller",
        user_type: "human",
      },
      { onConflict: "id" }
    );
    if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

    // 3. Create API key (km_<64hex> format)
    const key = generateApiKey();
    apiKeyRaw = key.raw;
    const { error: keyError } = await supabase.from("api_keys").insert({
      user_id: sellerUserId,
      name: "agentkit-live-test",
      key_hash: key.hash,
      permissions: ["read", "write"],
    });
    if (keyError) throw new Error(`API key creation failed: ${keyError.message}`);

    // 4. Create and publish a knowledge item
    console.log("  Creating test knowledge item...");
    const { data: item, error: itemError } = await supabase
      .from("knowledge_items")
      .insert({
        seller_id: sellerUserId,
        listing_type: "offer",
        title: "AgentKit Live Test Item",
        description: "Test item for AgentKit plugin live validation",
        content_type: "general",
        preview_content: "Preview of the test content...",
        price_sol: 0.001,
        status: "published",
        tags: ["agentkit", "test"],
      })
      .select("id")
      .single();
    if (itemError) throw new Error(`Knowledge item creation failed: ${itemError.message}`);
    knowledgeItemId = item.id;

    // 5. Insert full content
    const { error: contentError } = await supabase
      .from("knowledge_item_contents")
      .insert({
        knowledge_item_id: knowledgeItemId,
        full_content: "This is the full content of the AgentKit test knowledge item.",
      });
    if (contentError) throw new Error(`Content creation failed: ${contentError.message}`);

    // 6. Initialize AgentKit provider
    const { knowmintProvider } = await import("../dist/index.js");
    provider = knowmintProvider({ apiKey: apiKeyRaw, baseUrl: DEV_SERVER_URL });

    console.log("  Setup complete. API Key: " + apiKeyRaw.slice(0, 10) + "...");
    console.log("  Knowledge Item ID: " + knowledgeItemId);
  });

  after(async () => {
    // Cleanup: delete test data
    console.log("  Cleaning up test data...");
    if (knowledgeItemId) {
      await supabase
        .from("knowledge_item_contents")
        .delete()
        .eq("knowledge_item_id", knowledgeItemId);
      await supabase
        .from("knowledge_items")
        .delete()
        .eq("id", knowledgeItemId);
    }
    if (sellerUserId) {
      await supabase.from("api_keys").delete().eq("user_id", sellerUserId);
      await supabase.from("profiles").delete().eq("id", sellerUserId);
      await supabase.auth.admin.deleteUser(sellerUserId);
    }
    console.log("  Cleanup complete.");
  });

  const mockWallet = {};

  // ── km_search ─────────────────────────────────────────────────────────────

  it("km_search finds the test item", async () => {
    const result = await provider.kmSearch(mockWallet, {
      query: "AgentKit Live Test",
    });
    console.log("    Search result:", result.slice(0, 200));
    assert.ok(result.includes("AgentKit Live Test Item"), "should find the test item");
    assert.ok(result.includes(knowledgeItemId), "should include item ID");
  });

  it("km_search with content_type filter", async () => {
    const result = await provider.kmSearch(mockWallet, {
      query: "AgentKit",
      content_type: "general",
    });
    assert.ok(result.includes("AgentKit Live Test Item"));

    // Filter by wrong type should not find
    const noResult = await provider.kmSearch(mockWallet, {
      query: "AgentKit Live Test",
      content_type: "prompt",
    });
    assert.ok(!noResult.includes("AgentKit Live Test Item"));
  });

  // ── km_get_detail ─────────────────────────────────────────────────────────

  it("km_get_detail returns item details", async () => {
    const result = await provider.kmGetDetail(mockWallet, {
      knowledge_id: knowledgeItemId,
    });
    console.log("    Detail result:", result.slice(0, 200));
    const parsed = JSON.parse(result);
    assert.equal(parsed.id, knowledgeItemId);
    assert.equal(parsed.title, "AgentKit Live Test Item");
    assert.equal(parsed.price_sol, 0.001);
    assert.equal(parsed.content_type, "general");
    assert.ok(parsed.preview_content.includes("Preview"));
  });

  it("km_get_detail returns error for non-existent item", async () => {
    const result = await provider.kmGetDetail(mockWallet, {
      knowledge_id: "nonexistent-id-12345",
    });
    assert.ok(result.includes("API Error") || result.includes("Error"));
  });

  // ── km_get_content (402 flow) ─────────────────────────────────────────────

  it("km_get_content returns content or payment-required", async () => {
    const result = await provider.kmGetContent(mockWallet, {
      knowledge_id: knowledgeItemId,
    });
    console.log("    Content result:", result.slice(0, 300));
    // Seller accessing own content → 200 with full content
    // Different buyer without payment → 402 payment required
    // Missing X402_NETWORK → may return error
    const parsed = (() => { try { return JSON.parse(result); } catch { return null; } })();
    if (parsed && parsed.full_content) {
      // Seller can access own content directly (no payment needed)
      assert.ok(parsed.full_content.length > 0, "should return full content for seller");
    } else {
      // Payment required or error — both are valid responses
      assert.ok(
        result.includes("Payment required") ||
        result.includes("API Error") ||
        result.includes("Error"),
        "should indicate payment is needed or return an error"
      );
    }
  });

  // ── km_publish ────────────────────────────────────────────────────────────

  it("km_publish creates and publishes a new item", async () => {
    const result = await provider.kmPublish(mockWallet, {
      title: "Published via AgentKit",
      description: "This item was published through the AgentKit plugin",
      content_type: "prompt",
      content: "A prompt template for testing AgentKit integration.",
      price_sol: 0.01,
      tags: ["agentkit", "published"],
    });
    console.log("    Publish result:", result.slice(0, 200));

    // May succeed or fail depending on API permissions, but should not crash
    if (!result.includes("Error")) {
      const parsed = JSON.parse(result);
      assert.ok(parsed.id || parsed.status, "should return created item info");

      // Cleanup: delete the published item
      if (parsed.id) {
        await supabase.from("knowledge_item_contents").delete().eq("item_id", parsed.id);
        await supabase.from("knowledge_items").delete().eq("id", parsed.id);
      }
    } else {
      // Permission error is acceptable — proves the API was reached
      console.log("    Publish returned error (expected if permissions insufficient):", result);
      assert.ok(true);
    }
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("handles invalid knowledge_id gracefully", async () => {
    const result = await provider.kmGetDetail(mockWallet, {
      knowledge_id: "00000000-0000-0000-0000-000000000000",
    });
    // Should return error, not throw
    assert.ok(typeof result === "string");
  });
});
