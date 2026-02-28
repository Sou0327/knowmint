import * as assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "mocha";

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
// Mutable mock state (module-level so closures in before() capture them)
// -----------------------------------------------------------------------
let mockUser: { id: string } | null = { id: USER_ID };
let mockIsValidTxHash = true;
let mockVerifyResult: { valid: boolean; error?: string } = { valid: true };
let adminCallResults: Array<{ data?: unknown; error?: unknown }> = [];
let rpcResults: Array<{ data?: unknown; error?: unknown }> = [];
let mockGetUserByIdResult: { data: { user: { email?: string } | null }; error: unknown } = {
  data: { user: { email: "seller@test.com" } },
  error: null,
};
let sendEmailThrows = false;

// -----------------------------------------------------------------------
// Call tracking
// -----------------------------------------------------------------------
const adminCalls: Array<{ method: string; args: unknown[] }> = [];

// -----------------------------------------------------------------------
// Queue helpers
// -----------------------------------------------------------------------
function nextResult(): { data?: unknown; error?: unknown } {
  const r = adminCallResults.shift();
  if (r === undefined) throw new Error("adminCallResults queue exhausted — unexpected extra DB call");
  return r;
}

function nextRpcResult(): { data?: unknown; error?: unknown } {
  const r = rpcResults.shift();
  if (r === undefined) throw new Error("rpcResults queue exhausted — unexpected extra RPC call");
  return r;
}

// -----------------------------------------------------------------------
// Thenable chain mock
//
// Supabase client is PromiseLike at every step. Each chainable method
// returns a new thenable. When awaited, pops the next result from queue.
// Terminal methods (.single, .maybeSingle) pop synchronously on call.
// -----------------------------------------------------------------------
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
      adminCalls.push({ method: m, args });
      return makeThenable(nextResult);
    };
  }
  obj.maybeSingle = () => {
    adminCalls.push({ method: "maybeSingle", args: [] });
    return Promise.resolve(nextResult());
  };
  obj.single = () => {
    adminCalls.push({ method: "single", args: [] });
    return Promise.resolve(nextResult());
  };
  return obj;
}

// -----------------------------------------------------------------------
// Saved cache entries (to restore after tests)
// -----------------------------------------------------------------------
type SavedCache = Map<string, NodeJS.Module | undefined>;
let savedCache: SavedCache = new Map();

const MOCK_MODULES = [
  "@/lib/supabase/server",
  "@/lib/supabase/admin",
  "@/lib/solana/verify-transaction",
  "@/lib/email/send",
  "@/lib/email/templates",
];

function saveCacheEntries() {
  savedCache.clear();
  for (const mod of MOCK_MODULES) {
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
  // Also remove the purchase module (always fresh)
  try { delete require.cache[require.resolve("@/app/actions/purchase")]; } catch { /* ignore */ }
}

// -----------------------------------------------------------------------
// Mock installation
// -----------------------------------------------------------------------
function installMocks() {
  const serverPath = require.resolve("@/lib/supabase/server");
  require.cache[serverPath] = {
    id: serverPath, filename: serverPath, loaded: true,
    exports: {
      createClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: mockUser }, error: null }),
        },
      }),
    },
    parent: null, children: [], paths: [],
  } as unknown as NodeJS.Module;

  const adminPath = require.resolve("@/lib/supabase/admin");
  require.cache[adminPath] = {
    id: adminPath, filename: adminPath, loaded: true,
    exports: {
      getAdminClient: () => ({
        from: (table: string) => {
          adminCalls.push({ method: "from", args: [table] });
          return makeThenable(nextResult);
        },
        rpc: (fn: string, args: unknown) => {
          adminCalls.push({ method: "rpc", args: [fn, args] });
          return Promise.resolve(nextRpcResult());
        },
        auth: {
          admin: {
            getUserById: async (_id: string) => Promise.resolve(mockGetUserByIdResult),
          },
        },
      }),
    },
    parent: null, children: [], paths: [],
  } as unknown as NodeJS.Module;

  const verifyPath = require.resolve("@/lib/solana/verify-transaction");
  require.cache[verifyPath] = {
    id: verifyPath, filename: verifyPath, loaded: true,
    exports: {
      isValidSolanaTxHash: (_hash: string) => mockIsValidTxHash,
      verifySolanaPurchaseTransaction: async (_input: unknown) => mockVerifyResult,
    },
    parent: null, children: [], paths: [],
  } as unknown as NodeJS.Module;

  const sendPath = require.resolve("@/lib/email/send");
  require.cache[sendPath] = {
    id: sendPath, filename: sendPath, loaded: true,
    exports: {
      sendEmail: async (_opts: unknown) => {
        if (sendEmailThrows) throw new Error("email send error");
      },
    },
    parent: null, children: [], paths: [],
  } as unknown as NodeJS.Module;

  const templatesPath = require.resolve("@/lib/email/templates");
  require.cache[templatesPath] = {
    id: templatesPath, filename: templatesPath, loaded: true,
    exports: {
      purchaseCompletedEmailHtml: (_opts: unknown) => ({ subject: "test", html: "<p>test</p>" }),
    },
    parent: null, children: [], paths: [],
  } as unknown as NodeJS.Module;
}

function getRecordPurchase() {
  installMocks();
  try { delete require.cache[require.resolve("@/app/actions/purchase")]; } catch { /* ignore */ }
  return (require("@/app/actions/purchase") as { recordPurchase: Function }).recordPurchase;
}

// -----------------------------------------------------------------------
// Happy path setup
// -----------------------------------------------------------------------
function setupHappyPath() {
  adminCalls.length = 0;
  mockUser = { id: USER_ID };
  mockIsValidTxHash = true;
  mockVerifyResult = { valid: true };
  sendEmailThrows = false;
  mockGetUserByIdResult = { data: { user: { email: "seller@test.com" } }, error: null };
  adminCallResults = [
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
  rpcResults = [
    { data: null, error: null }, // confirm_transaction
  ];
}

// -----------------------------------------------------------------------
// Test suite — scoped before/after to avoid polluting other test files
// -----------------------------------------------------------------------
describe("recordPurchase() tests", () => {
  before(() => {
    saveCacheEntries();
    installMocks();
  });

  after(() => {
    restoreCacheEntries();
  });

  // -----------------------------------------------------------------------
  // Zod validation
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Zod validation", () => {
    beforeEach(() => { setupHappyPath(); });

    it("invalid UUID knowledgeId → { success: false, error: 'Invalid input' }", async () => {
      const fn = getRecordPurchase();
      const result = await fn("not-a-uuid", VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Invalid input");
    });

    it("empty txHash → { success: false, error: 'Invalid input' }", async () => {
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, "", "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Invalid input");
    });

    it("chain=solana + token=ETH → invalid combination → { success: false, error: 'Invalid input' }", async () => {
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "ETH", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Invalid input");
    });

    it("chain=base + token=SOL → invalid combination → { success: false, error: 'Invalid input' }", async () => {
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "base", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Invalid input");
    });

    it("termsAgreed=false → { success: false, error: 'Invalid input' }", async () => {
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", false as unknown as true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Invalid input");
    });
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Authentication", () => {
    beforeEach(() => { setupHappyPath(); });

    it("user=null → { success: false, error: 'Unauthorized' }", async () => {
      mockUser = null;
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Unauthorized");
    });
  });

  // -----------------------------------------------------------------------
  // Idempotency
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Idempotency", () => {
    beforeEach(() => { setupHappyPath(); });

    it("confirmed existing purchase → early return { success: true }", async () => {
      adminCallResults = [
        { data: { id: TX_ROW_ID }, error: null }, // confirmedTx maybeSingle → found
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, true);
    });

    it("existing tx same buyer/item pending → retry confirm → recheck confirmed → { success: true }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: { id: TX_ROW_ID, buyer_id: USER_ID, knowledge_item_id: KNOWLEDGE_ID, status: "pending" }, error: null },
        { data: { status: "confirmed" }, error: null },
      ];
      rpcResults = [{ data: null, error: null }];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, true);
    });

    it("existing tx same buyer/item pending → retry confirm RPC → recheck not confirmed → { success: false }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: { id: TX_ROW_ID, buyer_id: USER_ID, knowledge_item_id: KNOWLEDGE_ID, status: "pending" }, error: null },
        { data: { status: "pending" }, error: null },
      ];
      rpcResults = [{ data: null, error: null }];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Transaction confirmation retry failed");
    });

    it("existing tx with different buyer → { success: false, error: 'Transaction hash already used' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: { id: TX_ROW_ID, buyer_id: "other-user-id", knowledge_item_id: KNOWLEDGE_ID, status: "confirmed" }, error: null },
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Transaction hash already used");
    });
  });

  // -----------------------------------------------------------------------
  // EVM rejection
  // -----------------------------------------------------------------------
  describe("recordPurchase() — EVM rejection", () => {
    beforeEach(() => { setupHappyPath(); });

    it("chain=base → { success: false, error: 'Only Solana purchases are supported in this phase' }", async () => {
      adminCallResults = [{ data: null, error: null }, { data: null, error: null }];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "base", "ETH", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Only Solana purchases are supported in this phase");
    });

    it("chain=ethereum → { success: false, error: 'Only Solana purchases are supported in this phase' }", async () => {
      adminCallResults = [{ data: null, error: null }, { data: null, error: null }];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "ethereum", "ETH", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Only Solana purchases are supported in this phase");
    });
  });

  // -----------------------------------------------------------------------
  // txHash validation
  // -----------------------------------------------------------------------
  describe("recordPurchase() — txHash format validation", () => {
    beforeEach(() => {
      setupHappyPath();
      mockIsValidTxHash = false;
    });

    it("invalid txHash format → { success: false, error: 'Invalid Solana transaction hash format' }", async () => {
      adminCallResults = [{ data: null, error: null }, { data: null, error: null }];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Invalid Solana transaction hash format");
    });
  });

  // -----------------------------------------------------------------------
  // Item checks
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Item checks", () => {
    beforeEach(() => { setupHappyPath(); });

    it("item not found (single error) → { success: false, error: 'Item not found or not available' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: { message: "not found" } },
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Item not found or not available");
    });

    it("item status=draft → { success: false, error: 'Item not found or not available' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "draft", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Item not found or not available");
    });

    it("listing_type=request → { success: false, error: 'Request listings cannot be purchased' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "request", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Request listings cannot be purchased");
    });

    it("self-purchase (seller_id === user.id) → { success: false, error: 'Cannot purchase your own item' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: USER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Cannot purchase your own item");
    });

    it("price_sol=null → { success: false, error: 'Item has no price set for the selected token' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: null, price_usdc: null, title: "T" }, error: null },
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Item has no price set for the selected token");
    });

    it("price_sol=0 → { success: false, error: 'Item has no price set for the selected token' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0, price_usdc: 0, title: "T" }, error: null },
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Item has no price set for the selected token");
    });
  });

  // -----------------------------------------------------------------------
  // Wallet resolution
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Wallet resolution", () => {
    beforeEach(() => { setupHappyPath(); });

    it("walletProfiles fetch error → { success: false, error: 'Failed to resolve wallet addresses' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        { data: null, error: { message: "db error" } },
      ];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Failed to resolve wallet addresses");
    });

    it("missing buyer wallet → { success: false, error: 'Buyer and seller wallet addresses must be configured' }", async () => {
      adminCallResults = [
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
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Buyer and seller wallet addresses must be configured");
    });

    it("missing seller wallet → { success: false, error: 'Buyer and seller wallet addresses must be configured' }", async () => {
      adminCallResults = [
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
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Buyer and seller wallet addresses must be configured");
    });

    it("invalid PublicKey (garbage wallet address) → { success: false, error: 'Invalid wallet address format' }", async () => {
      adminCallResults = [
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
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Invalid wallet address format");
    });
  });

  // -----------------------------------------------------------------------
  // On-chain verification
  // -----------------------------------------------------------------------
  describe("recordPurchase() — On-chain verification", () => {
    beforeEach(() => { setupHappyPath(); });

    it("verification fails → { success: false, error: 'トランザクション検証に失敗しました' }", async () => {
      mockVerifyResult = { valid: false, error: "amount mismatch" };
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "トランザクション検証に失敗しました");
    });
  });

  // -----------------------------------------------------------------------
  // DB insert
  // -----------------------------------------------------------------------
  describe("recordPurchase() — DB insert", () => {
    beforeEach(() => { setupHappyPath(); });

    it("success path → confirm_transaction RPC → { success: true }", async () => {
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, true);
      // Verify correct tables and RPC were targeted
      const fromCalls = adminCalls.filter(c => c.method === "from");
      assert.ok(fromCalls.some(c => c.args[0] === "transactions"), "should query transactions table");
      assert.ok(fromCalls.some(c => c.args[0] === "knowledge_items"), "should query knowledge_items table");
      assert.ok(fromCalls.some(c => c.args[0] === "profiles"), "should query profiles table");
      const rpcCall = adminCalls.find(c => c.method === "rpc");
      assert.ok(rpcCall, "confirm_transaction RPC should be called");
      assert.equal(rpcCall!.args[0], "confirm_transaction");
    });

    it("23505 unique violation → recheck confirmed → { success: true }", async () => {
      adminCallResults = [
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
      rpcResults = [];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, true);
    });

    it("23505 unique violation → recheck not confirmed (different buyer) → { success: false, error: 'Transaction hash already used' }", async () => {
      adminCallResults = [
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
      rpcResults = [];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Transaction hash already used");
    });

    it("other insert error → { success: false, error: 'Failed to record purchase' }", async () => {
      adminCallResults = [
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: KNOWLEDGE_ID, seller_id: SELLER_ID, status: "published", listing_type: "offer", price_sol: 0.1, price_usdc: 1.0, title: "T" }, error: null },
        { data: [
            { id: SELLER_ID, wallet_address: SELLER_WALLET, display_name: "Seller" },
            { id: USER_ID, wallet_address: BUYER_WALLET, display_name: "Buyer" },
          ], error: null },
        { data: null, error: { code: "42P01", message: "table does not exist" } },
      ];
      rpcResults = [];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Failed to record purchase");
    });
  });

  // -----------------------------------------------------------------------
  // confirm_transaction RPC failure
  // -----------------------------------------------------------------------
  describe("recordPurchase() — confirm_transaction RPC failure", () => {
    beforeEach(() => { setupHappyPath(); });

    it("confirm_transaction RPC error → { success: false, error: 'Transaction confirmation failed' }", async () => {
      rpcResults = [{ data: null, error: { message: "RPC error" } }];
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, false);
      assert.equal(result.error, "Transaction confirmation failed");
    });
  });

  // -----------------------------------------------------------------------
  // Email fire-and-forget
  // -----------------------------------------------------------------------
  describe("recordPurchase() — Email fire-and-forget", () => {
    beforeEach(() => { setupHappyPath(); });

    it("email throw does not affect success result → { success: true }", async () => {
      sendEmailThrows = true;
      const fn = getRecordPurchase();
      const result = await fn(KNOWLEDGE_ID, VALID_TX_HASH, "solana", "SOL", true);
      assert.equal(result.success, true);
    });
  });
});
