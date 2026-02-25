import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

// ── Helpers ─────────────────────────────────────────────────────────────────

const VALID_API_KEY = "km_" + "a".repeat(64);

/** Start a local HTTP server that returns canned responses based on path */
function startMockServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// ── Import dist ─────────────────────────────────────────────────────────────

const {
  KmApiClient,
  KmApiError,
  knowmintProvider,
  KmSearchSchema,
  KmGetDetailSchema,
  KmPurchaseSchema,
  KmGetContentSchema,
  KmPublishSchema,
} = await import("../dist/index.js");

// ═══════════════════════════════════════════════════════════════════════════
// 1. KmApiClient — Construction Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("KmApiClient construction", () => {
  it("accepts valid API key and default base URL", () => {
    const client = new KmApiClient({ apiKey: VALID_API_KEY });
    assert.ok(client);
  });

  it("accepts valid API key with explicit base URL", () => {
    const client = new KmApiClient({
      apiKey: VALID_API_KEY,
      baseUrl: "https://example.com",
    });
    assert.ok(client);
  });

  it("accepts localhost with HTTP", () => {
    const client = new KmApiClient({
      apiKey: VALID_API_KEY,
      baseUrl: "http://localhost:3000",
    });
    assert.ok(client);
  });

  it("rejects invalid API key format", () => {
    assert.throws(
      () => new KmApiClient({ apiKey: "bad_key" }),
      /API key format is invalid/
    );
  });

  it("rejects too-short API key", () => {
    assert.throws(
      () => new KmApiClient({ apiKey: "km_abc" }),
      /API key format is invalid/
    );
  });

  it("rejects non-HTTPS for remote hosts", () => {
    assert.throws(
      () =>
        new KmApiClient({
          apiKey: VALID_API_KEY,
          baseUrl: "http://remote.example.com",
        }),
      /HTTPS/
    );
  });

  it("rejects URL with credentials", () => {
    assert.throws(
      () =>
        new KmApiClient({
          apiKey: VALID_API_KEY,
          baseUrl: "https://user:pass@example.com",
        }),
      /credentials/
    );
  });

  it("rejects non-HTTP protocol for localhost", () => {
    assert.throws(
      () =>
        new KmApiClient({
          apiKey: VALID_API_KEY,
          baseUrl: "ftp://localhost:21",
        }),
      /HTTP or HTTPS/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Zod Schemas
// ═══════════════════════════════════════════════════════════════════════════

describe("Zod schemas", () => {
  describe("KmSearchSchema", () => {
    it("accepts valid search", () => {
      const result = KmSearchSchema.safeParse({ query: "solana defi" });
      assert.ok(result.success);
    });

    it("rejects empty query", () => {
      const result = KmSearchSchema.safeParse({ query: "" });
      assert.ok(!result.success);
    });

    it("accepts all optional fields", () => {
      const result = KmSearchSchema.safeParse({
        query: "test",
        content_type: "prompt",
        max_results: 10,
        metadata_domain: "finance",
        sort_by: "popular",
      });
      assert.ok(result.success);
    });

    it("rejects invalid content_type", () => {
      const result = KmSearchSchema.safeParse({
        query: "test",
        content_type: "invalid",
      });
      assert.ok(!result.success);
    });

    it("strips unknown fields", () => {
      const result = KmSearchSchema.safeParse({
        query: "test",
        unknown_field: "value",
      });
      assert.ok(result.success);
      assert.equal(result.data.unknown_field, undefined);
    });
  });

  describe("KmGetDetailSchema", () => {
    it("accepts valid ID", () => {
      const result = KmGetDetailSchema.safeParse({
        knowledge_id: "abc-123_def",
      });
      assert.ok(result.success);
    });

    it("rejects ID with slashes", () => {
      const result = KmGetDetailSchema.safeParse({
        knowledge_id: "../etc/passwd",
      });
      assert.ok(!result.success);
    });

    it("rejects empty ID", () => {
      const result = KmGetDetailSchema.safeParse({ knowledge_id: "" });
      assert.ok(!result.success);
    });
  });

  describe("KmPurchaseSchema", () => {
    it("accepts valid purchase", () => {
      const result = KmPurchaseSchema.safeParse({
        knowledge_id: "item-1",
        tx_hash: "5abc123def",
      });
      assert.ok(result.success);
    });

    it("accepts with token and chain", () => {
      const result = KmPurchaseSchema.safeParse({
        knowledge_id: "item-1",
        tx_hash: "tx123",
        token: "USDC",
        chain: "solana",
      });
      assert.ok(result.success);
      assert.equal(result.data.token, "USDC");
    });

    it("rejects invalid token", () => {
      const result = KmPurchaseSchema.safeParse({
        knowledge_id: "item-1",
        tx_hash: "tx123",
        token: "ETH",
      });
      assert.ok(!result.success);
    });
  });

  describe("KmGetContentSchema", () => {
    it("accepts without payment_proof", () => {
      const result = KmGetContentSchema.safeParse({
        knowledge_id: "item-1",
      });
      assert.ok(result.success);
    });

    it("accepts with payment_proof", () => {
      const result = KmGetContentSchema.safeParse({
        knowledge_id: "item-1",
        payment_proof: "base64encodedproof",
      });
      assert.ok(result.success);
    });

    it("rejects payment_proof over 2048 chars", () => {
      const result = KmGetContentSchema.safeParse({
        knowledge_id: "item-1",
        payment_proof: "x".repeat(2049),
      });
      assert.ok(!result.success);
    });
  });

  describe("KmPublishSchema", () => {
    it("accepts with price_sol", () => {
      const result = KmPublishSchema.safeParse({
        title: "Test",
        description: "A test item",
        content_type: "prompt",
        content: "Some content",
        price_sol: 0.01,
      });
      assert.ok(result.success);
    });

    it("accepts with price_usdc", () => {
      const result = KmPublishSchema.safeParse({
        title: "Test",
        description: "A test item",
        content_type: "dataset",
        content: "data",
        price_usdc: 5.0,
      });
      assert.ok(result.success);
    });

    it("rejects without any price", () => {
      const result = KmPublishSchema.safeParse({
        title: "Test",
        description: "desc",
        content_type: "prompt",
        content: "data",
      });
      assert.ok(!result.success);
    });

    it("rejects Infinity price", () => {
      const result = KmPublishSchema.safeParse({
        title: "Test",
        description: "desc",
        content_type: "prompt",
        content: "data",
        price_sol: Infinity,
      });
      assert.ok(!result.success);
    });

    it("rejects negative price", () => {
      const result = KmPublishSchema.safeParse({
        title: "Test",
        description: "desc",
        content_type: "prompt",
        content: "data",
        price_sol: -1,
      });
      assert.ok(!result.success);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. KmApiClient — HTTP Integration (mock server)
// ═══════════════════════════════════════════════════════════════════════════

describe("KmApiClient HTTP methods", () => {
  let server, baseUrl, client;
  let lastRequest;

  before(async () => {
    const result = await startMockServer((req, res) => {
      // Capture request details
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        lastRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: body || null,
        };

        // Route responses
        if (req.url === "/api/v1/knowledge/item-1" && req.method === "GET") {
          jsonResponse(res, 200, {
            success: true,
            data: { id: "item-1", title: "Test Knowledge" },
          });
        } else if (
          req.url?.startsWith("/api/v1/knowledge?") &&
          req.method === "GET"
        ) {
          jsonResponse(res, 200, {
            success: true,
            data: [
              {
                id: "item-1",
                title: "Result 1",
                usefulness_score: 0.95,
                tags: ["solana", "defi"],
                seller: { trust_score: 4.5 },
              },
            ],
            pagination: { page: 1, per_page: 20, total: 1, total_pages: 1 },
          });
        } else if (
          req.url === "/api/v1/knowledge/item-1/purchase" &&
          req.method === "POST"
        ) {
          jsonResponse(res, 200, {
            success: true,
            data: { id: "tx-1", status: "confirmed" },
          });
        } else if (
          req.url === "/api/v1/knowledge/item-1/content" &&
          req.method === "GET"
        ) {
          // Check for payment - unpurchased returns 402
          if (!req.headers["x-payment"]) {
            jsonResponse(res, 402, {
              x402Version: 1,
              accepts: [
                {
                  scheme: "exact",
                  network: "solana:devnet",
                  maxAmountRequired: "10000000",
                  resource: "/api/v1/knowledge/item-1/content",
                  description: "Access to knowledge",
                  mimeType: "application/json",
                  payTo: "SeLLeR1111111111111111111111111111111111111",
                  maxTimeoutSeconds: 300,
                  asset: "native",
                },
              ],
              error: "Payment required",
            });
          } else {
            jsonResponse(res, 200, {
              success: true,
              data: {
                content: "Full content here",
                content_type: "prompt",
              },
            });
          }
        } else if (
          req.url === "/api/v1/knowledge" &&
          req.method === "POST"
        ) {
          jsonResponse(res, 200, {
            success: true,
            data: { id: "new-item-1" },
          });
        } else if (
          req.url === "/api/v1/knowledge/new-item-1/publish" &&
          req.method === "POST"
        ) {
          jsonResponse(res, 200, {
            success: true,
            data: { id: "new-item-1", status: "published" },
          });
        } else if (req.url === "/api/v1/error-500") {
          jsonResponse(res, 500, {
            error: { message: "Internal server error" },
          });
        } else if (req.url === "/api/v1/error-html") {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Error</h1><script>alert('xss')</script></body></html>");
        } else if (req.url === "/api/v1/bad-json") {
          jsonResponse(res, 200, { something: "else" }); // no success: true
        } else {
          jsonResponse(res, 404, { error: { message: "Not found" } });
        }
      });
    });
    server = result.server;
    baseUrl = result.baseUrl;
    client = new KmApiClient({ apiKey: VALID_API_KEY, baseUrl });
  });

  after(async () => {
    await closeServer(server);
  });

  beforeEach(() => {
    lastRequest = null;
  });

  it("GET sends correct Authorization header", async () => {
    await client.get("/api/v1/knowledge/item-1");
    assert.equal(lastRequest.headers.authorization, `Bearer ${VALID_API_KEY}`);
    assert.equal(lastRequest.headers.accept, "application/json");
  });

  it("GET returns parsed data", async () => {
    const data = await client.get("/api/v1/knowledge/item-1");
    assert.deepEqual(data, { id: "item-1", title: "Test Knowledge" });
  });

  it("POST sends JSON body", async () => {
    const data = await client.post("/api/v1/knowledge/item-1/purchase", {
      tx_hash: "abc123",
      token: "SOL",
    });
    assert.equal(lastRequest.method, "POST");
    assert.equal(lastRequest.headers["content-type"], "application/json");
    const parsed = JSON.parse(lastRequest.body);
    assert.equal(parsed.tx_hash, "abc123");
    assert.deepEqual(data, { id: "tx-1", status: "confirmed" });
  });

  it("getPaginated returns data + pagination", async () => {
    const result = await client.getPaginated("/api/v1/knowledge?query=test");
    assert.ok(Array.isArray(result.data));
    assert.equal(result.data.length, 1);
    assert.equal(result.pagination.total, 1);
  });

  it("getWithPayment returns PaymentRequiredResponse on 402", async () => {
    const result = await client.getWithPayment(
      "/api/v1/knowledge/item-1/content"
    );
    assert.equal(result.payment_required, true);
    assert.equal(result.x402Version, 1);
    assert.ok(Array.isArray(result.accepts));
    assert.equal(result.accepts.length, 1);
    assert.equal(result.accepts[0].payTo, "SeLLeR1111111111111111111111111111111111111");
    assert.equal(result.accepts[0].asset, "native");
  });

  it("getWithPayment with X-PAYMENT header returns content", async () => {
    const result = await client.getWithPayment(
      "/api/v1/knowledge/item-1/content",
      { "X-PAYMENT": "proof123" }
    );
    assert.equal(result.payment_required, undefined);
    assert.equal(result.content, "Full content here");
  });

  it("throws KmApiError on 500", async () => {
    await assert.rejects(
      () => client.get("/api/v1/error-500"),
      (err) => {
        assert.ok(err instanceof KmApiError);
        assert.equal(err.status, 500);
        assert.match(err.message, /Internal server error/);
        return true;
      }
    );
  });

  it("sanitizes HTML in error responses", async () => {
    await assert.rejects(
      () => client.get("/api/v1/error-html"),
      (err) => {
        assert.ok(err instanceof KmApiError);
        // HTML tags should be stripped
        assert.ok(!err.message.includes("<script>"));
        assert.ok(!err.message.includes("<html>"));
        return true;
      }
    );
  });

  it("throws on unexpected response shape", async () => {
    await assert.rejects(
      () => client.get("/api/v1/bad-json"),
      (err) => {
        assert.ok(err instanceof KmApiError);
        assert.match(err.message, /Unexpected API response/);
        return true;
      }
    );
  });

  it("402 filters out invalid accepts entries", async () => {
    // This is tested via the mock which returns valid entries
    // The filter logic is tested by the mock server always returning properly formed entries
    const result = await client.getWithPayment(
      "/api/v1/knowledge/item-1/content"
    );
    // All returned entries must have required fields
    for (const accept of result.accepts) {
      assert.equal(typeof accept.payTo, "string");
      assert.equal(typeof accept.maxAmountRequired, "string");
      assert.equal(typeof accept.asset, "string");
      assert.equal(typeof accept.scheme, "string");
      assert.equal(typeof accept.network, "string");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ActionProvider — Full E2E with mock server
// ═══════════════════════════════════════════════════════════════════════════

describe("KnowMintActionProvider", () => {
  let server, baseUrl, provider;
  const mockWallet = { signMessage: async () => "signed" };

  before(async () => {
    const result = await startMockServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        if (req.url?.startsWith("/api/v1/knowledge?") && req.method === "GET") {
          jsonResponse(res, 200, {
            success: true,
            data: [
              {
                id: "item-42",
                title: "Solana MEV Strategies",
                usefulness_score: 0.88,
                tags: ["solana", "mev"],
                metadata: { domain: "finance", experience_type: "how_to" },
                seller: { trust_score: 4.2 },
              },
              {
                id: "item-43",
                title: "DeFi Yield Guide",
                tags: null, // test null tags
                metadata: null, // test null metadata
              },
            ],
            pagination: { page: 1, per_page: 20, total: 2, total_pages: 1 },
          });
        } else if (
          req.url === "/api/v1/knowledge/item-42" &&
          req.method === "GET"
        ) {
          jsonResponse(res, 200, {
            success: true,
            data: {
              id: "item-42",
              title: "Solana MEV Strategies",
              price_sol: 0.01,
              seller_wallet: "SeLLeR1111111111111111111111111111111111111",
            },
          });
        } else if (
          req.url === "/api/v1/knowledge/item-42/purchase" &&
          req.method === "POST"
        ) {
          const parsed = JSON.parse(body);
          jsonResponse(res, 200, {
            success: true,
            data: {
              id: "purchase-1",
              tx_hash: parsed.tx_hash,
              status: "confirmed",
            },
          });
        } else if (
          req.url === "/api/v1/knowledge/item-42/content" &&
          req.method === "GET"
        ) {
          if (!req.headers["x-payment"]) {
            jsonResponse(res, 402, {
              x402Version: 1,
              accepts: [
                {
                  scheme: "exact",
                  network: "solana:devnet",
                  maxAmountRequired: "10000000",
                  resource: "/api/v1/knowledge/item-42/content",
                  description: "Access to knowledge",
                  mimeType: "application/json",
                  payTo: "SeLLeR1111111111111111111111111111111111111",
                  maxTimeoutSeconds: 300,
                  asset: "native",
                },
              ],
            });
          } else {
            jsonResponse(res, 200, {
              success: true,
              data: {
                content: "The full MEV strategies content...",
                content_type: "prompt",
              },
            });
          }
        } else if (
          req.url === "/api/v1/knowledge" &&
          req.method === "POST"
        ) {
          jsonResponse(res, 200, {
            success: true,
            data: { id: "new-pub-1" },
          });
        } else if (
          req.url === "/api/v1/knowledge/new-pub-1/publish" &&
          req.method === "POST"
        ) {
          jsonResponse(res, 200, {
            success: true,
            data: { id: "new-pub-1", status: "published" },
          });
        } else if (
          req.url === "/api/v1/knowledge/nonexistent" &&
          req.method === "GET"
        ) {
          jsonResponse(res, 404, {
            error: { message: "Knowledge item not found" },
          });
        } else {
          jsonResponse(res, 404, {
            error: { message: "Not found" },
          });
        }
      });
    });
    server = result.server;
    baseUrl = result.baseUrl;
    provider = knowmintProvider({ apiKey: VALID_API_KEY, baseUrl });
  });

  after(async () => {
    await closeServer(server);
  });

  it("supportsNetwork returns true for svm", () => {
    assert.equal(
      provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-devnet" }),
      true
    );
  });

  it("supportsNetwork returns false for evm", () => {
    assert.equal(
      provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" }),
      false
    );
  });

  it("km_search returns formatted results", async () => {
    const result = await provider.kmSearch(mockWallet, { query: "solana" });
    assert.ok(result.includes("2 results"));
    assert.ok(result.includes("Solana MEV Strategies"));
    assert.ok(result.includes("item-42"));
    assert.ok(result.includes("#solana"));
    assert.ok(result.includes("[Quality: 0.88]"));
    assert.ok(result.includes("[Trust: 4.20]"));
    assert.ok(result.includes("domain=finance"));
    // Second item with null tags/metadata should not crash
    assert.ok(result.includes("DeFi Yield Guide"));
  });

  it("km_get_detail returns JSON data", async () => {
    const result = await provider.kmGetDetail(mockWallet, {
      knowledge_id: "item-42",
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.id, "item-42");
    assert.equal(parsed.price_sol, 0.01);
  });

  it("km_get_detail returns error for non-existent item", async () => {
    const result = await provider.kmGetDetail(mockWallet, {
      knowledge_id: "nonexistent",
    });
    assert.ok(result.includes("API Error"));
    assert.ok(result.includes("404"));
  });

  it("km_purchase records purchase with tx_hash", async () => {
    const result = await provider.kmPurchase(mockWallet, {
      knowledge_id: "item-42",
      tx_hash: "5txHashABC123",
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.status, "confirmed");
    assert.equal(parsed.tx_hash, "5txHashABC123");
  });

  it("km_get_content returns payment instructions on 402", async () => {
    const result = await provider.kmGetContent(mockWallet, {
      knowledge_id: "item-42",
    });
    assert.ok(result.includes("Payment required"));
    assert.ok(result.includes("10000000 atomic units"));
    assert.ok(result.includes("SOL (native)"));
    assert.ok(result.includes("SeLLeR1111111111111111111111111111111111111"));
    assert.ok(result.includes("9 decimals"));
    assert.ok(result.includes("km_purchase"));
  });

  it("km_get_content returns content with payment_proof", async () => {
    const result = await provider.kmGetContent(mockWallet, {
      knowledge_id: "item-42",
      payment_proof: "base64proof",
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.content, "The full MEV strategies content...");
  });

  it("km_publish creates and publishes item", async () => {
    const result = await provider.kmPublish(mockWallet, {
      title: "My Knowledge",
      description: "Test knowledge item",
      content_type: "prompt",
      content: "This is the full content of my knowledge item.",
      price_sol: 0.05,
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.id, "new-pub-1");
    assert.equal(parsed.status, "published");
  });

  // ── Full autonomous purchase flow simulation ─────────────────────────────

  it("simulates full autonomous purchase flow", async () => {
    // Step 1: Search
    const searchResult = await provider.kmSearch(mockWallet, {
      query: "solana mev",
    });
    assert.ok(searchResult.includes("item-42"));

    // Step 2: Get detail
    const detail = await provider.kmGetDetail(mockWallet, {
      knowledge_id: "item-42",
    });
    const detailParsed = JSON.parse(detail);
    assert.equal(detailParsed.price_sol, 0.01);

    // Step 3: Try to get content → 402
    const content402 = await provider.kmGetContent(mockWallet, {
      knowledge_id: "item-42",
    });
    assert.ok(content402.includes("Payment required"));

    // Step 4: (In real flow, agent would use native_transfer here)
    // Step 5: Record purchase
    const purchase = await provider.kmPurchase(mockWallet, {
      knowledge_id: "item-42",
      tx_hash: "simulated_tx_hash_12345",
    });
    const purchaseParsed = JSON.parse(purchase);
    assert.equal(purchaseParsed.status, "confirmed");

    // Step 6: Get content with proof → success
    const contentFull = await provider.kmGetContent(mockWallet, {
      knowledge_id: "item-42",
      payment_proof: "proof_after_purchase",
    });
    const contentParsed = JSON.parse(contentFull);
    assert.ok(contentParsed.content.length > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Edge Cases & Security
// ═══════════════════════════════════════════════════════════════════════════

describe("Edge cases & security", () => {
  let server, baseUrl;

  before(async () => {
    const result = await startMockServer((req, res) => {
      req.on("data", () => {});
      req.on("end", () => {
        if (req.url === "/api/v1/ansi-error") {
          jsonResponse(res, 500, {
            error: {
              message: "Error \x1b[31mred text\x1b[0m and \x00null",
            },
          });
        } else if (req.url === "/api/v1/html-error") {
          jsonResponse(res, 500, {
            message: '<script>alert("xss")</script>Server error',
          });
        } else if (req.url === "/api/v1/402-malformed") {
          jsonResponse(res, 402, {
            x402Version: 1,
            accepts: [
              null,
              42,
              "string",
              { payTo: "addr" }, // missing other required fields
              {
                scheme: "exact",
                network: "solana:devnet",
                maxAmountRequired: "1000",
                resource: "/test",
                description: "test",
                mimeType: "application/json",
                payTo: "ValidAddr",
                maxTimeoutSeconds: 300,
                asset: "native",
              },
            ],
          });
        } else {
          jsonResponse(res, 404, { error: { message: "not found" } });
        }
      });
    });
    server = result.server;
    baseUrl = result.baseUrl;
  });

  after(async () => {
    await closeServer(server);
  });

  it("strips ANSI escape codes and control chars from errors", async () => {
    const client = new KmApiClient({ apiKey: VALID_API_KEY, baseUrl });
    await assert.rejects(
      () => client.get("/api/v1/ansi-error"),
      (err) => {
        assert.ok(!err.message.includes("\x1b"));
        assert.ok(!err.message.includes("\x00"));
        assert.ok(err.message.includes("red text"));
        return true;
      }
    );
  });

  it("strips HTML from error messages", async () => {
    const client = new KmApiClient({ apiKey: VALID_API_KEY, baseUrl });
    await assert.rejects(
      () => client.get("/api/v1/html-error"),
      (err) => {
        assert.ok(!err.message.includes("<script>"));
        assert.ok(err.message.includes("Server error"));
        return true;
      }
    );
  });

  it("filters malformed accepts entries in 402", async () => {
    const client = new KmApiClient({ apiKey: VALID_API_KEY, baseUrl });
    const result = await client.getWithPayment("/api/v1/402-malformed");
    assert.equal(result.payment_required, true);
    // Only the last valid entry should pass the filter
    assert.equal(result.accepts.length, 1);
    assert.equal(result.accepts[0].payTo, "ValidAddr");
  });
});
