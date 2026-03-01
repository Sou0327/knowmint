import { vi, expect, describe, it, beforeEach } from "vitest";

// -----------------------------------------------------------------------
// Hoisted mock state (constants live here so vi.hoisted can reference them)
// -----------------------------------------------------------------------
const { state, nextResult, USER_ID, ITEM_ID } = vi.hoisted(() => {
  const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
  const ITEM_ID = "660e8400-e29b-41d4-a716-446655440000";

  const state = {
    mockUser: { id: USER_ID } as { id: string } | null,
    callResults: [] as Array<{ data?: unknown; error?: unknown }>,
  };

  function nextResult(): { data?: unknown; error?: unknown } {
    const r = state.callResults.shift();
    if (r === undefined) throw new Error("callResults queue exhausted");
    return r;
  }

  return { state, nextResult, USER_ID, ITEM_ID };
});

// Supabase browser client mock (RLS-based, used in list/actions.ts)
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    function makeChain(): unknown {
      const obj: Record<string, unknown> = {
        single: () => Promise.resolve(nextResult()),
        maybeSingle: () => Promise.resolve(nextResult()),
        then(onFulfilled: (v: unknown) => unknown) {
          return Promise.resolve(nextResult()).then(onFulfilled);
        },
      };
      for (const m of ["select", "eq", "neq", "update", "insert", "upsert", "order", "limit"]) {
        obj[m] = (..._args: unknown[]) => makeChain();
      }
      return obj;
    }
    return { from: (_table: string) => makeChain() };
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: async () => state.mockUser,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async (_ns: string) => (key: string) => key,
}));

// Unused imports in publishListing — stub to prevent module load errors
vi.mock("@/lib/knowledge/versions", () => ({ createVersionSnapshot: vi.fn() }));
vi.mock("@/lib/knowledge/queries", () => ({ getCategories: vi.fn() }));
vi.mock("@/lib/knowledge/requestContent", () => ({
  buildRequestFullContent: vi.fn(),
  buildRequestPreviewContent: vi.fn(),
  normalizeRequestContent: vi.fn(),
}));

import { publishListing } from "@/app/(main)/list/actions";

// -----------------------------------------------------------------------
// SEC-1: agent publish block tests
// -----------------------------------------------------------------------
describe("publishListing() — SEC-1 agent publish block", () => {
  beforeEach(() => {
    state.mockUser = { id: USER_ID };
    state.callResults = [];
  });

  it("agent user_type → accessDenied error", async () => {
    // Profile fetch returns agent
    state.callResults = [
      { data: { user_type: "agent" }, error: null },
    ];
    const result = await publishListing(ITEM_ID);
    expect(result.error).toBe("accessDenied");
  });

  it("profile fetch DB error → listingPublishFailed error", async () => {
    // Profile fetch fails
    state.callResults = [
      { data: null, error: { message: "connection error" } },
    ];
    const result = await publishListing(ITEM_ID);
    expect(result.error).toBe("listingPublishFailed");
  });

  it("human user_type → passes SEC-1, proceeds to item fetch", async () => {
    // Profile fetch returns human, item fetch returns not found
    state.callResults = [
      { data: { user_type: "human" }, error: null },  // profile
      { data: null, error: null },                     // item maybeSingle
    ];
    const result = await publishListing(ITEM_ID);
    // Should reach item-not-found, NOT accessDenied
    expect(result.error).toBe("itemNotFound");
    expect(result.error).not.toBe("accessDenied");
  });

  it("null user_type → passes SEC-1 (new user protection)", async () => {
    // profile?.user_type === "agent" is false when user_type is null
    state.callResults = [
      { data: { user_type: null }, error: null },  // profile
      { data: null, error: null },                  // item maybeSingle
    ];
    const result = await publishListing(ITEM_ID);
    expect(result.error).toBe("itemNotFound");
    expect(result.error).not.toBe("accessDenied");
  });

  it("invalid UUID → rejected before DB calls", async () => {
    const result = await publishListing("not-a-uuid");
    expect(result.error).toBe("invalidInput");
  });
});
