import * as assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "mocha";

// -----------------------------------------------------------------------
// Mutable mock state — reset via beforeEach in each describe block
// -----------------------------------------------------------------------

/** Result returned when the query chain is awaited */
let mockQueryResult: { data: unknown; count: number | null; error: unknown } = {
  data: [],
  count: 0,
  error: null,
};

/** Result returned from .single() / .maybeSingle() */
let mockSingleResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};

/** Track which Supabase methods were called, with their args */
const calls: Array<{ method: string; args: unknown[] }> = [];

let rpcCalled = false;
let rpcArgs: unknown = null;

// -----------------------------------------------------------------------
// Proxy-based chainable Supabase mock
// -----------------------------------------------------------------------

// Whitelist of valid Supabase query-builder methods
const VALID_CHAIN_METHODS = new Set([
  "select", "eq", "neq", "in", "gte", "lte", "gt", "lt",
  "like", "ilike", "is", "not", "or", "filter",
  "limit", "range", "order", "insert", "upsert", "update", "delete",
  "textSearch", "match", "contains", "containedBy", "overlaps",
  "csv", "returns", "count", "head", "rollback",
  "abortSignal", "throwOnError",
]);

function createChain(
  awaitResult: { data: unknown; count?: number | null; error: unknown },
  singleResult: { data: unknown; error: unknown },
) {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string | symbol) {
      // Symbol access (e.g. Symbol.toStringTag, Symbol.toPrimitive) — ignore silently
      if (typeof prop === "symbol") return undefined;
      if (prop === "then") {
        return (
          resolve: (v: unknown) => void,
          reject?: (e: unknown) => void,
        ) => Promise.resolve(awaitResult).then(resolve, reject);
      }
      if (prop === "single") {
        return () => Promise.resolve(singleResult);
      }
      if (prop === "maybeSingle") {
        return () => Promise.resolve(singleResult);
      }
      // Reject unknown methods to catch typos and invalid API usage
      if (!VALID_CHAIN_METHODS.has(prop)) {
        throw new Error(`Supabase mock: unknown query-builder method "${prop}". Add it to VALID_CHAIN_METHODS if this is a valid Supabase method.`);
      }
      // Valid chainable methods: record call and return new proxy
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

function createSupabaseMock() {
  return {
    from: (_table: string) => {
      calls.push({ method: "from", args: [_table] });
      return createChain(
        {
          data: mockQueryResult.data,
          count: mockQueryResult.count,
          error: mockQueryResult.error,
        },
        {
          data: mockSingleResult.data,
          error: mockSingleResult.error,
        },
      );
    },
  };
}

function createAdminMock() {
  return {
    from: (_table: string) => {
      calls.push({ method: "admin.from", args: [_table] });
      return createChain(
        {
          data: mockQueryResult.data,
          count: mockQueryResult.count,
          error: mockQueryResult.error,
        },
        {
          data: mockSingleResult.data,
          error: mockSingleResult.error,
        },
      );
    },
    rpc: async (_name: string, _args: unknown) => {
      rpcCalled = true;
      rpcArgs = { name: _name, args: _args };
      return { data: null, error: null };
    },
  };
}

// -----------------------------------------------------------------------
// Saved cache entries for restore-on-cleanup
// -----------------------------------------------------------------------
type SavedCache = Map<string, NodeJS.Module | undefined>;
let savedCache: SavedCache = new Map();

const MOCK_MODULES_LIST = [
  "@/lib/supabase/server",
  "@/lib/supabase/admin",
  "@/lib/knowledge/queries",
];

function saveCacheEntries() {
  savedCache.clear();
  for (const mod of MOCK_MODULES_LIST) {
    try {
      const p = require.resolve(mod);
      savedCache.set(p, require.cache[p]);
    } catch { /* ignore */ }
  }
}

function restoreCacheEntries() {
  for (const [p, entry] of savedCache.entries()) {
    if (entry === undefined) {
      delete require.cache[p];
    } else {
      require.cache[p] = entry;
    }
  }
}

// -----------------------------------------------------------------------
// Test suite — scoped before/after to avoid polluting other test files
// -----------------------------------------------------------------------
describe("knowledge queries tests", () => {

before(() => {
  saveCacheEntries();

  // Mock @/lib/supabase/server
  const serverPath = require.resolve("@/lib/supabase/server");
  require.cache[serverPath] = {
    id: serverPath,
    filename: serverPath,
    loaded: true,
    exports: {
      createClient: async () => createSupabaseMock(),
    },
    parent: null,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;

  // Mock @/lib/supabase/admin
  const adminPath = require.resolve("@/lib/supabase/admin");
  require.cache[adminPath] = {
    id: adminPath,
    filename: adminPath,
    loaded: true,
    exports: {
      getAdminClient: () => createAdminMock(),
    },
    parent: null,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;

  // Pass-through @/lib/supabase/utils (pure function — real implementation)
  // No mock needed; just ensure it loads after the above mocks are in place.

  // Evict the queries module so it re-resolves with our mocks
  try {
    delete require.cache[require.resolve("@/lib/knowledge/queries")];
  } catch {
    // ignore if not cached yet
  }
});

after(() => {
  restoreCacheEntries();
});

// Helper to get fresh module reference
function getQueries() {
  // Delete and reload every time so mutable mock state is picked up correctly
  try {
    delete require.cache[require.resolve("@/lib/knowledge/queries")];
  } catch {
    // ignore
  }
  return require("@/lib/knowledge/queries") as typeof import("@/lib/knowledge/queries");
}

// -----------------------------------------------------------------------
// getPublishedKnowledge()
// -----------------------------------------------------------------------

describe("getPublishedKnowledge()", () => {
  beforeEach(() => {
    calls.length = 0;
    rpcCalled = false;
    rpcArgs = null;
    mockQueryResult = { data: [], count: 0, error: null };
    mockSingleResult = { data: null, error: null };
  });

  it("DB error → returns empty result with zeros", async () => {
    mockQueryResult = { data: null, count: null, error: { message: "DB error" } };
    const { getPublishedKnowledge } = getQueries();
    const result = await getPublishedKnowledge();
    assert.deepStrictEqual(result.data, []);
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.total_pages, 0);
  });

  it("returns data array with total and total_pages", async () => {
    const row = {
      id: "abc",
      seller_id: "seller1",
      listing_type: "fixed",
      title: "Test",
      description: "desc",
      content_type: "prompt",
      price_sol: 1.0,
      price_usdc: null,
      preview_content: null,
      category_id: null,
      tags: [],
      status: "published",
      view_count: 5,
      purchase_count: 2,
      average_rating: 4.5,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      seller: { id: "seller1", display_name: "Alice", avatar_url: null, trust_score: 0.9 },
      category: null,
    };
    mockQueryResult = { data: [row], count: 1, error: null };
    const { getPublishedKnowledge } = getQueries();
    const result = await getPublishedKnowledge();
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.total_pages, 1);
    assert.strictEqual(result.page, 1);
    assert.strictEqual(result.per_page, 12);
  });

  it("default page=1, per_page=12 → range called with 0,11", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge();
    const rangeCall = calls.find((c) => c.method === "range");
    assert.ok(rangeCall, "range should be called");
    assert.deepStrictEqual(rangeCall!.args, [0, 11]);
  });

  it("page=2, per_page=10 → range called with 10,19", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ page: 2, per_page: 10 });
    const rangeCall = calls.find((c) => c.method === "range");
    assert.ok(rangeCall, "range should be called");
    assert.deepStrictEqual(rangeCall!.args, [10, 19]);
  });

  it("total_pages = ceil(total / per_page)", async () => {
    mockQueryResult = { data: [], count: 25, error: null };
    const { getPublishedKnowledge } = getQueries();
    const result = await getPublishedKnowledge({ per_page: 10 });
    assert.strictEqual(result.total, 25);
    assert.strictEqual(result.total_pages, 3);
  });

  it("query filter → textSearch is called", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ query: "machine learning" });
    const textSearchCall = calls.find((c) => c.method === "textSearch");
    assert.ok(textSearchCall, "textSearch should be called when query is set");
    assert.strictEqual(textSearchCall!.args[0], "search_vector");
    assert.strictEqual(textSearchCall!.args[1], "machine learning");
  });

  it("category filter → eq called with categories.slug", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ category: "finance" });
    const eqCall = calls.find(
      (c) => c.method === "eq" && c.args[0] === "categories.slug",
    );
    assert.ok(eqCall, "eq on categories.slug should be called");
    assert.strictEqual(eqCall!.args[1], "finance");
  });

  it("content_type filter → eq called with content_type", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ content_type: "prompt" });
    const eqCall = calls.find(
      (c) => c.method === "eq" && c.args[0] === "content_type",
    );
    assert.ok(eqCall, "eq on content_type should be called");
    assert.strictEqual(eqCall!.args[1], "prompt");
  });

  it("min_price filter → gte called with price_sol", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ min_price: 0.5 });
    const gteCall = calls.find((c) => c.method === "gte");
    assert.ok(gteCall, "gte should be called for min_price");
    assert.strictEqual(gteCall!.args[0], "price_sol");
    assert.strictEqual(gteCall!.args[1], 0.5);
  });

  it("max_price filter → lte called with price_sol", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ max_price: 2.0 });
    const lteCall = calls.find((c) => c.method === "lte");
    assert.ok(lteCall, "lte should be called for max_price");
    assert.strictEqual(lteCall!.args[0], "price_sol");
    assert.strictEqual(lteCall!.args[1], 2.0);
  });

  it("sort_by=newest (default) → order by created_at desc", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ sort_by: "newest" });
    const orderCall = calls.find(
      (c) => c.method === "order" && c.args[0] === "created_at",
    );
    assert.ok(orderCall, "order on created_at should be called");
    assert.deepStrictEqual(orderCall!.args[1], { ascending: false });
  });

  it("sort_by=popular → order by purchase_count desc", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ sort_by: "popular" });
    const orderCall = calls.find(
      (c) => c.method === "order" && c.args[0] === "purchase_count",
    );
    assert.ok(orderCall, "order on purchase_count should be called");
    assert.deepStrictEqual(orderCall!.args[1], { ascending: false });
  });

  it("sort_by=price_low → order by price_sol asc", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ sort_by: "price_low" });
    const orderCall = calls.find(
      (c) => c.method === "order" && c.args[0] === "price_sol",
    );
    assert.ok(orderCall, "order on price_sol should be called");
    assert.strictEqual((orderCall!.args[1] as Record<string, unknown>).ascending, true);
  });

  it("sort_by=price_high → order by price_sol desc", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ sort_by: "price_high" });
    const orderCall = calls.find(
      (c) => c.method === "order" && c.args[0] === "price_sol",
    );
    assert.ok(orderCall, "order on price_sol should be called");
    assert.strictEqual((orderCall!.args[1] as Record<string, unknown>).ascending, false);
  });

  it("sort_by=rating → order by average_rating desc", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ sort_by: "rating" });
    const orderCall = calls.find(
      (c) => c.method === "order" && c.args[0] === "average_rating",
    );
    assert.ok(orderCall, "order on average_rating should be called");
    assert.strictEqual((orderCall!.args[1] as Record<string, unknown>).ascending, false);
  });

  it("sort_by=trust_score → limit(200) called, range NOT called", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getPublishedKnowledge } = getQueries();
    await getPublishedKnowledge({ sort_by: "trust_score" });
    const limitCall = calls.find((c) => c.method === "limit");
    assert.ok(limitCall, "limit should be called for trust_score sort");
    assert.strictEqual(limitCall!.args[0], 200);
    const rangeCall = calls.find((c) => c.method === "range");
    assert.ok(!rangeCall, "range should NOT be called for trust_score sort");
  });

  it("sort_by=trust_score → items sorted by seller.trust_score desc, null last", async () => {
    const makeRow = (id: string, trustScore: number | null) => ({
      id,
      seller_id: `seller_${id}`,
      listing_type: "fixed",
      title: `Item ${id}`,
      description: "",
      content_type: "prompt",
      price_sol: 1.0,
      price_usdc: null,
      preview_content: null,
      category_id: null,
      tags: [],
      status: "published",
      view_count: 0,
      purchase_count: 0,
      average_rating: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      seller: trustScore !== null
        ? { id: `seller_${id}`, display_name: null, avatar_url: null, trust_score: trustScore }
        : null,
      category: null,
    });

    // Unsorted order: low=0.3, high=0.9, null
    mockQueryResult = {
      data: [makeRow("low", 0.3), makeRow("high", 0.9), makeRow("noSeller", null)],
      count: 3,
      error: null,
    };
    const { getPublishedKnowledge } = getQueries();
    const result = await getPublishedKnowledge({ sort_by: "trust_score" });
    assert.strictEqual(result.data[0].id, "high");
    assert.strictEqual(result.data[1].id, "low");
    assert.strictEqual(result.data[2].id, "noSeller");
  });

  it("sort_by=trust_score → effectiveTotal = min(count, 200)", async () => {
    mockQueryResult = { data: [], count: 350, error: null };
    const { getPublishedKnowledge } = getQueries();
    const result = await getPublishedKnowledge({ sort_by: "trust_score" });
    assert.strictEqual(result.total, 200);
    assert.strictEqual(result.total_pages, Math.ceil(200 / 12));
  });

  it("sort_by=trust_score, page=2, per_page=2 → second page slice", async () => {
    const makeRow = (id: string, trustScore: number) => ({
      id,
      seller_id: `s${id}`,
      listing_type: "fixed",
      title: `Item ${id}`,
      description: "",
      content_type: "prompt",
      price_sol: 1.0,
      price_usdc: null,
      preview_content: null,
      category_id: null,
      tags: [],
      status: "published",
      view_count: 0,
      purchase_count: 0,
      average_rating: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      seller: { id: `s${id}`, display_name: null, avatar_url: null, trust_score: trustScore },
      category: null,
    });
    // Scores: A=1.0, B=0.8, C=0.6, D=0.4 → sorted: A,B,C,D
    mockQueryResult = {
      data: [makeRow("D", 0.4), makeRow("B", 0.8), makeRow("C", 0.6), makeRow("A", 1.0)],
      count: 4,
      error: null,
    };
    const { getPublishedKnowledge } = getQueries();
    const result = await getPublishedKnowledge({ sort_by: "trust_score", page: 2, per_page: 2 });
    assert.strictEqual(result.data.length, 2);
    assert.strictEqual(result.data[0].id, "C");
    assert.strictEqual(result.data[1].id, "D");
    assert.strictEqual(result.page, 2);
  });

  it("seller as array → toSingle normalizes to first element", async () => {
    const row = {
      id: "xyz",
      seller_id: "s1",
      listing_type: "fixed",
      title: "T",
      description: "d",
      content_type: "prompt",
      price_sol: null,
      price_usdc: null,
      preview_content: null,
      category_id: null,
      tags: [],
      status: "published",
      view_count: 0,
      purchase_count: 0,
      average_rating: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      // Supabase nested join can return array
      seller: [{ id: "s1", display_name: "Bob", avatar_url: null, trust_score: 0.5 }],
      category: null,
    };
    mockQueryResult = { data: [row], count: 1, error: null };
    const { getPublishedKnowledge } = getQueries();
    const result = await getPublishedKnowledge();
    assert.strictEqual(result.data[0].seller?.display_name, "Bob");
  });
});

// -----------------------------------------------------------------------
// getKnowledgeById()
// -----------------------------------------------------------------------

describe("getKnowledgeById()", () => {
  beforeEach(() => {
    calls.length = 0;
    rpcCalled = false;
    rpcArgs = null;
    mockQueryResult = { data: [], count: 0, error: null };
    mockSingleResult = { data: null, error: null };
  });

  it("returns null when error is returned", async () => {
    mockSingleResult = { data: null, error: { message: "not found" } };
    const { getKnowledgeById } = getQueries();
    const result = await getKnowledgeById("nonexistent-id");
    assert.strictEqual(result, null);
  });

  it("returns null when data is null (not found)", async () => {
    mockSingleResult = { data: null, error: null };
    const { getKnowledgeById } = getQueries();
    const result = await getKnowledgeById("some-id");
    assert.strictEqual(result, null);
  });

  it("returns item with normalized seller and category when found", async () => {
    const item = {
      id: "item-1",
      seller_id: "seller-1",
      listing_type: "fixed",
      title: "My Knowledge",
      description: "desc",
      content_type: "prompt",
      price_sol: 0.5,
      price_usdc: null,
      preview_content: "preview",
      category_id: "cat-1",
      tags: ["ai"],
      status: "published",
      view_count: 10,
      purchase_count: 3,
      average_rating: 4.0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      seller: [
        {
          id: "seller-1",
          display_name: "Alice",
          avatar_url: null,
          trust_score: 0.8,
          bio: "bio text",
          user_type: "individual",
          wallet_address: "wallet123",
        },
      ],
      category: [{ id: "cat-1", name: "Finance", slug: "finance" }],
      reviews: [],
    };
    mockSingleResult = { data: item, error: null };
    const { getKnowledgeById } = getQueries();
    const result = await getKnowledgeById("item-1");
    assert.ok(result !== null);
    assert.strictEqual(result.id, "item-1");
    assert.strictEqual(result.title, "My Knowledge");
    // seller array normalized to object
    assert.strictEqual(result.seller?.display_name, "Alice");
    // category array normalized to object
    assert.strictEqual(result.category?.slug, "finance");
    assert.deepStrictEqual(result.reviews, []);
  });

  it("normalizes reviews with nested reviewer arrays", async () => {
    const item = {
      id: "item-2",
      seller_id: "s",
      listing_type: "fixed",
      title: "T",
      description: "d",
      content_type: "prompt",
      price_sol: 1.0,
      price_usdc: null,
      preview_content: null,
      category_id: null,
      tags: [],
      status: "published",
      view_count: 0,
      purchase_count: 0,
      average_rating: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      seller: null,
      category: null,
      reviews: [
        {
          id: "rev-1",
          rating: 5,
          comment: "Great!",
          created_at: "2026-01-02T00:00:00Z",
          reviewer: [{ id: "u1", display_name: "Bob", avatar_url: null }],
        },
      ],
    };
    mockSingleResult = { data: item, error: null };
    const { getKnowledgeById } = getQueries();
    const result = await getKnowledgeById("item-2");
    assert.ok(result !== null);
    assert.strictEqual(result.reviews.length, 1);
    assert.strictEqual(result.reviews[0].reviewer?.display_name, "Bob");
  });

  it("fires increment_view_count RPC (fire-and-forget)", async () => {
    const item = {
      id: "item-3",
      seller_id: "s",
      listing_type: "fixed",
      title: "T",
      description: "d",
      content_type: "prompt",
      price_sol: 1.0,
      price_usdc: null,
      preview_content: null,
      category_id: null,
      tags: [],
      status: "published",
      view_count: 0,
      purchase_count: 0,
      average_rating: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      seller: null,
      category: null,
      reviews: [],
    };
    mockSingleResult = { data: item, error: null };
    const { getKnowledgeById } = getQueries();
    await getKnowledgeById("item-3");
    // Give the fire-and-forget a tick to resolve
    await new Promise((r) => setImmediate(r));
    assert.ok(rpcCalled, "increment_view_count RPC should be called");
    assert.deepStrictEqual((rpcArgs as { name: string; args: unknown }).name, "increment_view_count");
    assert.deepStrictEqual((rpcArgs as { name: string; args: { item_id: string } }).args, { item_id: "item-3" });
  });
});

// -----------------------------------------------------------------------
// getKnowledgeByCategory()
// -----------------------------------------------------------------------

describe("getKnowledgeByCategory()", () => {
  beforeEach(() => {
    calls.length = 0;
    rpcCalled = false;
    rpcArgs = null;
    mockQueryResult = { data: [], count: 0, error: null };
    mockSingleResult = { data: null, error: null };
  });

  it("returns null category and empty items when category not found", async () => {
    // .single() for category lookup returns null
    mockSingleResult = { data: null, error: { message: "not found" } };
    const { getKnowledgeByCategory } = getQueries();
    const result = await getKnowledgeByCategory("nonexistent-slug");
    assert.strictEqual(result.category, null);
    assert.deepStrictEqual(result.items, []);
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.total_pages, 0);
  });

  it("returns category and items with pagination", async () => {
    const category = { id: "cat-1", name: "Finance", slug: "finance" };
    mockSingleResult = { data: category, error: null };

    const row = {
      id: "item-1",
      seller_id: "s1",
      listing_type: "fixed",
      title: "Finance Knowledge",
      description: "desc",
      content_type: "dataset",
      price_sol: 0.5,
      price_usdc: null,
      preview_content: null,
      category_id: "cat-1",
      tags: ["finance"],
      status: "published",
      view_count: 7,
      purchase_count: 1,
      average_rating: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      seller: { id: "s1", display_name: "Alice", avatar_url: null, trust_score: null },
      category: { id: "cat-1", name: "Finance", slug: "finance" },
    };
    mockQueryResult = { data: [row], count: 1, error: null };
    const { getKnowledgeByCategory } = getQueries();
    const result = await getKnowledgeByCategory("finance");
    assert.ok(result.category !== null);
    assert.strictEqual(result.category.slug, "finance");
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].id, "item-1");
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.total_pages, 1);
    assert.strictEqual(result.page, 1);
  });

  it("pagination: page=2, perPage=5 → range(5, 9)", async () => {
    const category = { id: "cat-2", name: "AI", slug: "ai" };
    mockSingleResult = { data: category, error: null };
    mockQueryResult = { data: [], count: 0, error: null };
    const { getKnowledgeByCategory } = getQueries();
    await getKnowledgeByCategory("ai", 2, 5);
    const rangeCall = calls.find((c) => c.method === "range");
    assert.ok(rangeCall, "range should be called");
    assert.deepStrictEqual(rangeCall!.args, [5, 9]);
  });

  it("total_pages = ceil(total / perPage)", async () => {
    const category = { id: "cat-3", name: "Tech", slug: "tech" };
    mockSingleResult = { data: category, error: null };
    mockQueryResult = { data: [], count: 23, error: null };
    const { getKnowledgeByCategory } = getQueries();
    const result = await getKnowledgeByCategory("tech", 1, 10);
    assert.strictEqual(result.total, 23);
    assert.strictEqual(result.total_pages, 3);
  });

  it("data null from DB → items is empty array", async () => {
    const category = { id: "cat-4", name: "Empty", slug: "empty" };
    mockSingleResult = { data: category, error: null };
    mockQueryResult = { data: null, count: 0, error: null };
    const { getKnowledgeByCategory } = getQueries();
    const result = await getKnowledgeByCategory("empty");
    assert.deepStrictEqual(result.items, []);
  });
});

// -----------------------------------------------------------------------
// getCategories()
// -----------------------------------------------------------------------

describe("getCategories()", () => {
  beforeEach(() => {
    calls.length = 0;
    rpcCalled = false;
    rpcArgs = null;
    mockQueryResult = { data: [], count: 0, error: null };
    mockSingleResult = { data: null, error: null };
  });

  it("returns categories array", async () => {
    const cats = [
      { id: "c1", name: "Finance", slug: "finance", icon: "coin" },
      { id: "c2", name: "Tech", slug: "tech", icon: "chip" },
    ];
    mockQueryResult = { data: cats, count: cats.length, error: null };
    const { getCategories } = getQueries();
    const result = await getCategories();
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, "Finance");
    assert.strictEqual(result[1].slug, "tech");
  });

  it("returns empty array when data is null", async () => {
    mockQueryResult = { data: null, count: null, error: null };
    const { getCategories } = getQueries();
    const result = await getCategories();
    assert.deepStrictEqual(result, []);
  });

  it("returns empty array when no categories exist", async () => {
    mockQueryResult = { data: [], count: 0, error: null };
    const { getCategories } = getQueries();
    const result = await getCategories();
    assert.deepStrictEqual(result, []);
  });
});

}); // knowledge queries tests
