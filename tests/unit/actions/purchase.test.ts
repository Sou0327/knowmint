import { vi, expect, describe, it, beforeEach } from "vitest";

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------
const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const SELLER_ID = "660e8400-e29b-41d4-a716-446655440001";
const KNOWLEDGE_ID = "660e8400-e29b-41d4-a716-446655440000";
const VALID_TX_HASH = "A".repeat(87);
const BUYER_WALLET = "BuyerAddr11111111111111111111111111111111111";
// "A".repeat(44) is a valid canonical base58 Solana public key
const SELLER_WALLET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TX_ROW_ID = "770e8400-e29b-41d4-a716-446655440000";

// -----------------------------------------------------------------------
// Hoisted mock state + helpers
// -----------------------------------------------------------------------
const { state, makeThenable, nextResult, nextRpcResult } = vi.hoisted(() => {
  const state = {
    mockUser: { id: "550e8400-e29b-41d4-a716-446655440000" } as { id: string } | null,
    mockIsValidTxHash: true,
    mockVerifyResult: { valid: true } as { valid: boolean; error?: string },
    adminCallResults: [] as Array<{ data?: unknown; error?: unknown }>,
    rpcResults: [] as Array<{ data?: unknown; error?: unknown }>,
    mockGetUserByIdResult: {
      data: { user: { email: "seller@test.com" } },
      error: null,
    } as { data: { user: { email?: string } | null }; error: unknown },
    sendEmailThrows: false,
    adminCalls: [] as Array<{ method: string; args: unknown[] }>,
  };

  function nextResult(): { data?: unknown; error?: unknown } {
    const r = state.adminCallResults.shift();
    if (r === undefined) throw new Error("adminCallResults queue exhausted — unexpected extra DB call");
    return r;
  }

  function nextRpcResult(): { data?: unknown; error?: unknown } {
    const r = state.rpcResults.shift();
    if (r === undefined) throw new Error("rpcResults queue exhausted — unexpected extra RPC call");
    return r;
  }

  function makeThenable(pop: () => { data?: unknown; error?: unknown }): unknown {
    const obj: Record<string, unknown> = {
      then(onFulfilled: (v: unknown) => unknown, _onRejected?: unknown) {
        return Promise.resolve(pop()).then(onFulfilled);
      },
      catch(_onRejected: unknown) {
        return Promise.resolve(pop());
      },
    };
    const chainMethods = [
      "select", "eq", "neq", "in", "gte", "lte", "limit",
      "range", "order", "upsert", "update", "delete",
      "textSearch", "filter", "not", "or", "insert",
    ];
    for (const m of chainMethods) {
      obj[m] = (...args: unknown[]) => {
        state.adminCalls.push({ method: m, args });
        return makeThenable(nextResult);
      };
    }
    obj.maybeSingle = () => {
      state.adminCalls.push({ method: "maybeSingle", args: [] });
      return Promise.resolve(nextResult());
    };
    obj.single = () => {
      state.adminCalls.push({ method: "single", args: [] });
      return Promise.resolve(nextResult());
    };
    return obj;
  }

  return { state, makeThenable, nextResult, nextRpcResult };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.mockUser }, error: null }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      state.adminCalls.push({ method: "from", args: [table] });
      return makeThenable(nextResult);
    },
    rpc: (fn: string, args: unknown) => {
      state.adminCalls.push({ method: "rpc", args: [fn, args] });
      return Promise.resolve(nextRpcResult());
    },
    auth: {
      admin: {
        getUserById: async (_id: string) => Promise.resolve(state.mockGetUserByIdResult),
      },
    },
  }),
}));

vi.mock("@/lib/solana/verify-transaction", () => ({
  isValidSolanaTxHash: (_hash: string) => state.mockIsValidTxHash,
  verifySolanaPurchaseTransaction: async (_input: unknown) => state.mockVerifyResult,
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: async (_opts: unknown) => {
    if (state.sendEmailThrows) throw new Error("email send error");
  },
}));

vi.mock("@/lib/email/templates", () => ({
  purchaseCompletedEmailHtml: (_opts: unknown) => ({ subject: "test", html: "<p>test</p>" }),
}));

import { recordPurchase } from "@/app/actions/purchase";

// -----------------------------------------------------------------------
// Happy path setup
// -----------------------------------------------------------------------
function setupHappyPath() {
  state.adminCalls.length = 0;
  state.mockUser = { id: USER_ID };
  state.mockIsValidTxHash = true;
  state.mockVerifyResult = { valid: true };
  state.sendEmailThrows = false;
  state.mockGetUserByIdResult = { data: { user: { email: "seller@test.com" } }, error: null };
  state.adminCallResults = [
    { data: null, error: null },  // 1: confirmedTx maybeSingle
    { data: null, error: null },  // 2: existing tx maybeSingle
    {
      data: {
        id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published",
        listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "Test Item",
      },
      error: null,
    }, // 3: item single
    {
      data: [
        { id: SELLER_ID, wallet_address: SELLER_WALLET, display_name: "Seller" },
        { id: USER_ID, wallet_address: BUYER_WALLET, display_name: "Buyer" },
      ],
      error: null,
    }, // 4: walletProfiles in()
    { data: { id: TX_ROW_ID }, error: null }, // 5: insert single
  ];
  state.rpcResults = [
    { data: 1, error: null }, // confirm_transaction: 実際に pending→confirmed に遷移した件数
  ];
}

// -----------------------------------------------------------------------
// Test suite
// -----------------------------------------------------------------------
describe("recordPurchase() tests", () => {

  // -----------------------------------------------------------------------
  // Zod validation
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Zod validation", () => {
    beforeEach(() => { setupHappyPath(); });

    it("invalid UUID knowledgeId → { success: false, error: 'Invalid input' }", async () => {
      const result = await recordPurchase("not-a-uuid", VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid input");
    });

    it("empty txHash → { success: false, error: 'Invalid input' }", async () => {
      const result = await recordPurchase(KNOWLEDGE_ID, "", "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid input");
    });

    it("chain=solana + token=ETH → invalid combination → { success: false, error: 'Invalid input' }", async () => {
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "ETH", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid input");
    });

    it("chain=base + token=SOL → invalid combination → { success: false, error: 'Invalid input' }", async () => {
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "base", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid input");
    });

    it("termsAgreed=false → { success: false, error: 'Invalid input' }", async () => {
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", false as unknown as true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid input");
    });
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Authentication", () => {
    beforeEach(() => { setupHappyPath(); });

    it("user=null → { success: false, error: 'Unauthorized' }", async () => {
      state.mockUser = null;
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });
  });

  // -----------------------------------------------------------------------
  // Idempotency
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Idempotency", () => {
    beforeEach(() => { setupHappyPath(); });

    it("confirmed existing purchase → early return { success: true }", async () => {
      state.adminCallResults = [
        { data: { id: TX_ROW_ID }, error: null }, // confirmedTx maybeSingle → found
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(true);
    });

    it("existing tx same buyer/item pending → retry confirm (RPC=1) → early return { success: true }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: { id: TX_ROW_ID, buyer_id: USER_ID, knowledge_item_id: KNOWLEDGE_ID, status: "pending" }, error: null },
      ];
      state.rpcResults = [{ data: 1, error: null }]; // RPC returned 1 → confirmed
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(true);
    });

    it("existing tx same buyer/item pending → retry confirm (RPC=0) → recheck confirmed → { success: true }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: { id: TX_ROW_ID, buyer_id: USER_ID, knowledge_item_id: KNOWLEDGE_ID, status: "pending" }, error: null },
        { data: { status: "confirmed" }, error: null },
      ];
      state.rpcResults = [{ data: 0, error: null }]; // concurrent request confirmed first
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(true);
    });

    it("existing tx same buyer/item pending → retry confirm (RPC=0) → recheck not confirmed → { success: false }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: { id: TX_ROW_ID, buyer_id: USER_ID, knowledge_item_id: KNOWLEDGE_ID, status: "pending" }, error: null },
        { data: { status: "pending" }, error: null },
      ];
      state.rpcResults = [{ data: 0, error: null }]; // 0 rows updated, status still pending
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Transaction confirmation retry failed");
    });

    it("existing tx with different buyer → { success: false, error: 'Transaction hash already used' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: { id: TX_ROW_ID, buyer_id: "other-user-id", knowledge_item_id: KNOWLEDGE_ID, status: "confirmed" }, error: null },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Transaction hash already used");
    });
  });

  // -----------------------------------------------------------------------
  // EVM rejection
  // -----------------------------------------------------------------------
  describe("recordPurchase() — EVM rejection", () => {
    beforeEach(() => { setupHappyPath(); });

    it("chain=base → { success: false, error: 'Only Solana purchases are supported in this phase' }", async () => {
      state.adminCallResults = [{ data: null, error: null }, { data: null, error: null }];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "base", "ETH", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Only Solana purchases are supported in this phase");
    });

    it("chain=ethereum → { success: false, error: 'Only Solana purchases are supported in this phase' }", async () => {
      state.adminCallResults = [{ data: null, error: null }, { data: null, error: null }];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "ethereum", "ETH", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Only Solana purchases are supported in this phase");
    });
  });

  // -----------------------------------------------------------------------
  // txHash validation
  // -----------------------------------------------------------------------
  describe("recordPurchase() — txHash format validation", () => {
    beforeEach(() => {
      setupHappyPath();
      state.mockIsValidTxHash = false;
    });

    it("invalid txHash format → { success: false, error: 'Invalid Solana transaction hash format' }", async () => {
      state.adminCallResults = [{ data: null, error: null }, { data: null, error: null }];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid Solana transaction hash format");
    });
  });

  // -----------------------------------------------------------------------
  // Item checks
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Item checks", () => {
    beforeEach(() => { setupHappyPath(); });

    it("item not found (single error) → { success: false, error: 'Item not found or not available' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: { message: "not found" } },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found or not available");
    });

    it("item status=draft → { success: false, error: 'Item not found or not available' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "draft", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found or not available");
    });

    it("listing_type=request → { success: false, error: 'Request listings cannot be purchased' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "request", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Request listings cannot be purchased");
    });

    it("self-purchase (seller_id === user.id) → { success: false, error: 'Cannot purchase your own item' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: USER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot purchase your own item");
    });

    it("price_sol=null → { success: false, error: 'Item has no price set for the selected token' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: null, price_usdc: null, title: "T" }, error: null },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Item has no price set for the selected token");
    });

    it("price_sol=0 → { success: false, error: 'Item has no price set for the selected token' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0, price_usdc: 0, title: "T" }, error: null },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Item has no price set for the selected token");
    });
  });

  // -----------------------------------------------------------------------
  // Wallet resolution
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Wallet resolution", () => {
    beforeEach(() => { setupHappyPath(); });

    it("walletProfiles fetch error → { success: false, error: 'Failed to resolve wallet addresses' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        { data: null, error: { message: "db error" } },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to resolve wallet addresses");
    });

    it("missing buyer wallet → { success: false, error: 'Buyer and seller wallet addresses must be configured' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        {
          data: [
            { id: SELLER_ID, wallet_address: SELLER_WALLET, display_name: "Seller" },
            { id: USER_ID, wallet_address: null, display_name: "Buyer" },
          ],
          error: null,
        },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Buyer and seller wallet addresses must be configured");
    });

    it("missing seller wallet → { success: false, error: 'Buyer and seller wallet addresses must be configured' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        {
          data: [
            { id: SELLER_ID, wallet_address: null, display_name: "Seller" },
            { id: USER_ID, wallet_address: BUYER_WALLET, display_name: "Buyer" },
          ],
          error: null,
        },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Buyer and seller wallet addresses must be configured");
    });

    it("invalid PublicKey (garbage wallet address) → { success: false, error: 'Invalid wallet address format' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        {
          data: [
            { id: SELLER_ID, wallet_address: "not-a-valid-public-key!!!", display_name: "Seller" },
            { id: USER_ID, wallet_address: BUYER_WALLET, display_name: "Buyer" },
          ],
          error: null,
        },
      ];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid wallet address format");
    });
  });

  // -----------------------------------------------------------------------
  // On-chain verification
  // -----------------------------------------------------------------------
  describe("recordPurchase() — On-chain verification", () => {
    beforeEach(() => { setupHappyPath(); });

    it("verification fails → { success: false, error: 'トランザクション検証に失敗しました' }", async () => {
      state.mockVerifyResult = { valid: false, error: "amount mismatch" };
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("トランザクション検証に失敗しました");
    });
  });

  // -----------------------------------------------------------------------
  // DB insert
  // -----------------------------------------------------------------------
  describe("recordPurchase() — DB insert", () => {
    beforeEach(() => { setupHappyPath(); });

    it("success path → confirm_transaction RPC → { success: true }", async () => {
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(true);
      // Verify correct tables and RPC were targeted
      const fromCalls = state.adminCalls.filter(c => c.method === "from");
      expect(fromCalls.some(c => c.args[0] === "transactions")).toBeTruthy();
      expect(fromCalls.some(c => c.args[0] === "knowledge_items")).toBeTruthy();
      expect(fromCalls.some(c => c.args[0] === "profiles")).toBeTruthy();
      const rpcCall = state.adminCalls.find(c => c.method === "rpc");
      expect(rpcCall).toBeTruthy();
      expect(rpcCall!.args[0]).toBe("confirm_transaction");
    });

    it("23505 unique violation → recheck confirmed → { success: true }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        { data: [
            { id: SELLER_ID, wallet_address: SELLER_WALLET, display_name: "Seller" },
            { id: USER_ID, wallet_address: BUYER_WALLET, display_name: "Buyer" },
          ], error: null },
        { data: null, error: { code: "23505", message: "unique violation" } },
        { data: { id: TX_ROW_ID, buyer_id: USER_ID, knowledge_item_id: KNOWLEDGE_ID, status: "confirmed" }, error: null },
      ];
      state.rpcResults = [];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(true);
    });

    it("23505 unique violation → recheck not confirmed (different buyer) → { success: false, error: 'Transaction hash already used' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        { data: [
            { id: SELLER_ID, wallet_address: SELLER_WALLET, display_name: "Seller" },
            { id: USER_ID, wallet_address: BUYER_WALLET, display_name: "Buyer" },
          ], error: null },
        { data: null, error: { code: "23505", message: "unique violation" } },
        { data: { id: TX_ROW_ID, buyer_id: "other-buyer", knowledge_item_id: KNOWLEDGE_ID, status: "pending" }, error: null },
      ];
      state.rpcResults = [];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Transaction hash already used");
    });

    it("other insert error → { success: false, error: 'Failed to record purchase' }", async () => {
      state.adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        { data: [
            { id: SELLER_ID, wallet_address: SELLER_WALLET, display_name: "Seller" },
            { id: USER_ID, wallet_address: BUYER_WALLET, display_name: "Buyer" },
          ], error: null },
        { data: null, error: { code: "42P01", message: "table does not exist" } },
      ];
      state.rpcResults = [];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to record purchase");
    });
  });

  // -----------------------------------------------------------------------
  // confirm_transaction RPC failure
  // -----------------------------------------------------------------------
  describe("recordPurchase() — confirm_transaction RPC failure", () => {
    beforeEach(() => { setupHappyPath(); });

    it("confirm_transaction RPC error → { success: false, error: 'Transaction confirmation failed' }", async () => {
      state.rpcResults = [{ data: null, error: { message: "RPC error" } }];
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Transaction confirmation failed");
    });
  });

  // -----------------------------------------------------------------------
  // Email fire-and-forget
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Email fire-and-forget", () => {
    beforeEach(() => { setupHappyPath(); });

    it("email throw does not affect success result → { success: true }", async () => {
      state.sendEmailThrows = true;
      const result = await recordPurchase(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      expect(result.success).toBe(true);
    });
  });
});
