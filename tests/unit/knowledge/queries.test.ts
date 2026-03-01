import { vi, expect, describe, it, beforeEach } from "vitest";

// -----------------------------------------------------------------------
// Hoisted mock state + helper functions
// -----------------------------------------------------------------------
const { state, createSupabaseMock, createAdminMock } = vi.hoisted(() => {
  type QueryResult = { data: unknown; count: number | null; error: unknown };
  type SingleResult = { data: unknown; error: unknown };
  type CallEntry = { method: string; args: unknown[] };

  const state = {
    mockQueryResult: { data: [], count: 0, error: null } as QueryResult,
    mockSingleResult: { data: null, error: null } as SingleResult,
    calls: [] as CallEntry[],
    rpcCalled: false,
    rpcArgs: null as unknown,
  };

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
    awaitResult: QueryResult,
    singleResult: SingleResult,
  ) {
    const handler: ProxyHandler<object> = {
      get(_target, prop: string | symbol) {
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
        if (!VALID_CHAIN_METHODS.has(prop as string)) {
          throw new Error(`Supabase mock: unknown query-builder method "${String(prop)}".`);
        }
        return (...args: unknown[]) => {
          state.calls.push({ method: prop as string, args });
          return new Proxy({}, handler);
        };
      },
    };
    return new Proxy({}, handler);
  }

  function createSupabaseMock() {
    return {
      from: (_table: string) => {
        state.calls.push({ method: "from", args: [_table] });
        return createChain(
          { data: state.mockQueryResult.data, count: state.mockQueryResult.count, error: state.mockQueryResult.error },
          { data: state.mockSingleResult.data, error: state.mockSingleResult.error },
        );
      },
    };
  }

  function createAdminMock() {
    return {
      from: (_table: string) => {
        state.calls.push({ method: "admin.from", args: [_table] });
        return createChain(
          { data: state.mockQueryResult.data, count: state.mockQueryResult.count, error: state.mockQueryResult.error },
          { data: state.mockSingleResult.data, error: state.mockSingleResult.error },
        );
      },
      rpc: async (_name: string, _args: unknown) => {
        state.rpcCalled = true;
        state.rpcArgs = { name: _name, args: _args };
        return { data: null, error: null };
      },
    };
  }

  return { state, createSupabaseMock, createAdminMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createSupabaseMock(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => createAdminMock(),
}));

import {
  getPublishedKnowledge,
  getKnowledgeById,
} from "@/lib/knowledge/queries";

// -----------------------------------------------------------------------
// Test suite
// -----------------------------------------------------------------------
describe("knowledge queries tests", () => {

// -----------------------------------------------------------------------
// getPublishedKnowledge()
// -----------------------------------------------------------------------
describe("getPublishedKnowledge()", () => {
  beforeEach(() => {
    state.calls.length = 0;
    state.rpcCalled = false;
    state.rpcArgs = null;
    state.mockQueryResult = { data: [], count: 0, error: null };
    state.mockSingleResult = { data: null, error: null };
  });

  it("DB error → returns empty result with zeros", async () => {
    state.mockQueryResult = { data: null, count: null, error: { message: "DB error" } };
    const result = await getPublishedKnowledge();
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.total_pages).toBe(0);
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
    state.mockQueryResult = { data: [row], count: 1, error: null };
    const result = await getPublishedKnowledge();
    expect(result.data.length).toBe(1);
    expect(result.total).toBe(1);
    expect(result.total_pages).toBe(1);
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(12);
  });

  it("default page=1, per_page=12 → range called with 0,11", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge();
    const rangeCall = state.calls.find((c) => c.method === "range");
    expect(rangeCall).toBeTruthy();
    expect(rangeCall!.args).toEqual([0, 11]);
  });

  it("page=2, per_page=10 → range called with 10,19", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ page: 2, per_page: 10 });
    const rangeCall = state.calls.find((c) => c.method === "range");
    expect(rangeCall).toBeTruthy();
    expect(rangeCall!.args).toEqual([10, 19]);
  });

  it("total_pages = ceil(total / per_page)", async () => {
    state.mockQueryResult = { data: [], count: 25, error: null };
    const result = await getPublishedKnowledge({ per_page: 10 });
    expect(result.total).toBe(25);
    expect(result.total_pages).toBe(3);
  });

  it("query filter → textSearch is called", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ query: "machine learning" });
    const textSearchCall = state.calls.find((c) => c.method === "textSearch");
    expect(textSearchCall).toBeTruthy();
    expect(textSearchCall!.args[0]).toBe("search_vector");
    expect(textSearchCall!.args[1]).toBe("machine learning");
  });

  it("category filter → eq called with categories.slug", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ category: "finance" });
    const eqCall = state.calls.find(
      (c) => c.method === "eq" && c.args[0] === "categories.slug",
    );
    expect(eqCall).toBeTruthy();
    expect(eqCall!.args[1]).toBe("finance");
  });

  it("content_type filter → eq called with content_type", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ content_type: "prompt" });
    const eqCall = state.calls.find(
      (c) => c.method === "eq" && c.args[0] === "content_type",
    );
    expect(eqCall).toBeTruthy();
    expect(eqCall!.args[1]).toBe("prompt");
  });

  it("min_price filter → gte called with price_sol", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ min_price: 0.5 });
    const gteCall = state.calls.find((c) => c.method === "gte");
    expect(gteCall).toBeTruthy();
    expect(gteCall!.args[0]).toBe("price_sol");
    expect(gteCall!.args[1]).toBe(0.5);
  });

  it("max_price filter → lte called with price_sol", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ max_price: 2.0 });
    const lteCall = state.calls.find((c) => c.method === "lte");
    expect(lteCall).toBeTruthy();
    expect(lteCall!.args[0]).toBe("price_sol");
    expect(lteCall!.args[1]).toBe(2.0);
  });

  it("sort_by=newest (default) → order by created_at desc", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ sort_by: "newest" });
    const orderCall = state.calls.find(
      (c) => c.method === "order" && c.args[0] === "created_at",
    );
    expect(orderCall).toBeTruthy();
    expect(orderCall!.args[1]).toEqual({ ascending: false });
  });

  it("sort_by=popular → order by purchase_count desc", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ sort_by: "popular" });
    const orderCall = state.calls.find(
      (c) => c.method === "order" && c.args[0] === "purchase_count",
    );
    expect(orderCall).toBeTruthy();
    expect(orderCall!.args[1]).toEqual({ ascending: false });
  });

  it("sort_by=price_low → order by price_sol asc", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ sort_by: "price_low" });
    const orderCall = state.calls.find(
      (c) => c.method === "order" && c.args[0] === "price_sol",
    );
    expect(orderCall).toBeTruthy();
    expect((orderCall!.args[1] as Record<string, unknown>).ascending).toBe(true);
  });

  it("sort_by=price_high → order by price_sol desc", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ sort_by: "price_high" });
    const orderCall = state.calls.find(
      (c) => c.method === "order" && c.args[0] === "price_sol",
    );
    expect(orderCall).toBeTruthy();
    expect((orderCall!.args[1] as Record<string, unknown>).ascending).toBe(false);
  });

  it("sort_by=rating → order by average_rating desc", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ sort_by: "rating" });
    const orderCall = state.calls.find(
      (c) => c.method === "order" && c.args[0] === "average_rating",
    );
    expect(orderCall).toBeTruthy();
    expect((orderCall!.args[1] as Record<string, unknown>).ascending).toBe(false);
  });

  it("sort_by=trust_score → limit(200) called, range NOT called", async () => {
    state.mockQueryResult = { data: [], count: 0, error: null };
    await getPublishedKnowledge({ sort_by: "trust_score" });
    const limitCall = state.calls.find((c) => c.method === "limit");
    expect(limitCall).toBeTruthy();
    expect(limitCall!.args[0]).toBe(200);
    const rangeCall = state.calls.find((c) => c.method === "range");
    expect(rangeCall).toBeFalsy();
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

    state.mockQueryResult = {
      data: [makeRow("low", 0.3), makeRow("high", 0.9), makeRow("noSeller", null)],
      count: 3,
      error: null,
    };
    const result = await getPublishedKnowledge({ sort_by: "trust_score" });
    expect(result.data[0].id).toBe("high");
    expect(result.data[1].id).toBe("low");
    expect(result.data[2].id).toBe("noSeller");
  });

  it("sort_by=trust_score → effectiveTotal = min(count, 200)", async () => {
    state.mockQueryResult = { data: [], count: 500, error: null };
    const result = await getPublishedKnowledge({ sort_by: "trust_score" });
    expect(result.total).toBe(200);
  });
});

}); // end describe("knowledge queries tests")
