import * as assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "mocha";

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------
const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
// Valid canonical base58 Solana public key
const VALID_WALLET = "BuyerAddr11111111111111111111111111111111111";
const VALID_NONCE = "a".repeat(64);

// -----------------------------------------------------------------------
// Mutable mock state
// -----------------------------------------------------------------------
let mockUser: { id: string } | null = { id: USER_ID };
let mockUpsertResult: { error: unknown } = { error: null };
let mockRpcResult: { data?: unknown; error?: unknown } = { data: "ok", error: null };
let lastUpsertArgs: { data: unknown; opts?: unknown } | null = null;
let lastRpcArgs: { fn: string; args: unknown } | null = null;
let mockEd25519VerifyResult = true;

// -----------------------------------------------------------------------
// Saved cache entries for restore-on-cleanup
// -----------------------------------------------------------------------
type SavedCache = Map<string, NodeJS.Module | undefined>;
let savedCache: SavedCache = new Map();

const MOCK_MODULE_KEYS = [
  "@/lib/supabase/server",
  "@/lib/supabase/admin",
  "@/app/actions/wallet",
  "@/lib/siws/message",
];

function saveCacheEntries() {
  savedCache.clear();
  for (const mod of MOCK_MODULE_KEYS) {
    try {
      const p = require.resolve(mod);
      savedCache.set(p, require.cache[p]);
    } catch { /* ignore */ }
  }
  // Also save ed25519
  try {
    const p = require.resolve("@noble/curves/ed25519");
    savedCache.set(p, require.cache[p]);
  } catch { /* ignore */ }
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
// Mock installation
// -----------------------------------------------------------------------
function installMocks() {
  const serverPath = require.resolve("@/lib/supabase/server");
  require.cache[serverPath] = {
    id: serverPath, filename: serverPath, loaded: true,
    exports: {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: mockUser },
            error: mockUser ? null : new Error("not authenticated"),
          }),
        },
      }),
    },
    parent: null, children: [], paths: [],
  } as unknown as NodeJS.Module;

  const adminPath = require.resolve("@/lib/supabase/admin");
  function makeAdminChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    const passthrough = () => chain;
    for (const m of [
      "from", "select", "eq", "neq", "in", "gte", "lte",
      "limit", "range", "order", "insert", "update", "delete",
    ]) {
      chain[m] = passthrough;
    }
    chain.upsert = (data: unknown, opts?: unknown) => {
      lastUpsertArgs = { data, opts };
      return Promise.resolve(mockUpsertResult);
    };
    chain.single = () => Promise.resolve({ data: null, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.rpc = (fn: string, args: unknown) => {
      lastRpcArgs = { fn, args };
      return Promise.resolve(mockRpcResult);
    };
    return chain;
  }
  require.cache[adminPath] = {
    id: adminPath, filename: adminPath, loaded: true,
    exports: { getAdminClient: () => makeAdminChain() },
    parent: null, children: [], paths: [],
  } as unknown as NodeJS.Module;

  // Patch ed25519.verify — load real module first if not already patched
  const ed25519Path = require.resolve("@noble/curves/ed25519");
  const currentEntry = require.cache[ed25519Path];
  const isPatched = currentEntry && (currentEntry.exports as Record<string, unknown>).__patched;
  if (!isPatched) {
    // Temporarily remove any stale entry, load real module
    delete require.cache[ed25519Path];
  }
  const realExports = require(ed25519Path) as typeof import("@noble/curves/ed25519");
  require.cache[ed25519Path] = {
    id: ed25519Path, filename: ed25519Path, loaded: true,
    exports: {
      ...realExports,
      __patched: true,
      ed25519: {
        ...realExports.ed25519,
        verify: (_sig: Uint8Array, _msg: Uint8Array, _pub: Uint8Array) => mockEd25519VerifyResult,
      },
    },
    parent: null, children: [], paths: [],
  } as unknown as NodeJS.Module;
}

function getActions() {
  installMocks();
  try { delete require.cache[require.resolve("@/app/actions/wallet")]; } catch { /* ignore */ }
  return require("@/app/actions/wallet") as {
    requestWalletChallenge: (wallet: string) => Promise<
      { success: true; nonce: string; message: string } | { success: false; error: string }
    >;
    verifyWalletSignature: (
      wallet: string,
      signatureBase64: string,
      nonce: string
    ) => Promise<{ success: true } | { success: false; error: string }>;
  };
}

// 64-byte base64 encoded signature (arbitrary bytes, structurally valid)
function validSig64Base64(): string {
  return Buffer.alloc(64, 0xab).toString("base64");
}

// -----------------------------------------------------------------------
// Test suite — scoped before/after to avoid polluting other test files
// -----------------------------------------------------------------------
describe("wallet actions tests", () => {
  before(() => {
    saveCacheEntries();
    installMocks();
  });

  after(() => {
    restoreCacheEntries();
  });

  beforeEach(() => {
    mockUser = { id: USER_ID };
    mockUpsertResult = { error: null };
    mockRpcResult = { data: "ok", error: null };
    mockEd25519VerifyResult = true;
    lastUpsertArgs = null;
    lastRpcArgs = null;
  });

  // -----------------------------------------------------------------------
  // requestWalletChallenge — Auth
  // -----------------------------------------------------------------------
  describe("requestWalletChallenge() — Auth", () => {
    it("user=null → { success: false, error: '認証が必要です' }", async () => {
      mockUser = null;
      const { requestWalletChallenge } = getActions();
      const result = await requestWalletChallenge(VALID_WALLET);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "認証が必要です");
    });
  });

  // -----------------------------------------------------------------------
  // requestWalletChallenge — Wallet validation
  // -----------------------------------------------------------------------
  describe("requestWalletChallenge() — Wallet validation", () => {
    it("invalid PublicKey → { success: false, error: 'Invalid Solana wallet address' }", async () => {
      const { requestWalletChallenge } = getActions();
      const result = await requestWalletChallenge("not-a-valid-key!!");
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "Invalid Solana wallet address");
    });

    it("non-canonical base58 address → { success: false, error: 'Invalid Solana wallet address' }", async () => {
      // Prepending '1' (zero byte) to a valid key creates a string that decodes to more than
      // 32 bytes, causing PublicKey constructor to throw → "Invalid Solana wallet address"
      const nonCanonical = "1" + VALID_WALLET;
      const { requestWalletChallenge } = getActions();
      const result = await requestWalletChallenge(nonCanonical);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "Invalid Solana wallet address");
    });
  });

  // -----------------------------------------------------------------------
  // requestWalletChallenge — Upsert error
  // -----------------------------------------------------------------------
  describe("requestWalletChallenge() — Upsert error", () => {
    it("upsert error → { success: false, error: 'チャレンジの生成に失敗しました' }", async () => {
      mockUpsertResult = { error: { message: "db error" } };
      const { requestWalletChallenge } = getActions();
      const result = await requestWalletChallenge(VALID_WALLET);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "チャレンジの生成に失敗しました");
    });
  });

  // -----------------------------------------------------------------------
  // requestWalletChallenge — Success
  // -----------------------------------------------------------------------
  describe("requestWalletChallenge() — Success", () => {
    it("returns { success: true, nonce: 64-char hex, message containing wallet + userId }", async () => {
      const { requestWalletChallenge } = getActions();
      const result = await requestWalletChallenge(VALID_WALLET);
      assert.equal(result.success, true);
      if (result.success) {
        assert.ok(/^[0-9a-f]{64}$/.test(result.nonce), `nonce not 64 hex: ${result.nonce}`);
        assert.ok(result.message.includes(VALID_WALLET), "message should contain wallet");
        assert.ok(result.message.includes(USER_ID), "message should contain userId");
      }
      // Verify upsert was called with challenge data
      assert.ok(lastUpsertArgs !== null, "upsert should have been called");
      const upsertData = lastUpsertArgs!.data as Record<string, unknown>;
      assert.equal(upsertData.wallet, VALID_WALLET, "upsert data should contain wallet");
      assert.equal(upsertData.user_id, USER_ID, "upsert data should contain user_id");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — Auth
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — Auth", () => {
    it("user=null → { success: false, error: '認証が必要です' }", async () => {
      mockUser = null;
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "認証が必要です");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — Wallet validation
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — Wallet validation", () => {
    it("invalid wallet → { success: false, error: 'Invalid Solana wallet address' }", async () => {
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature("INVALID!WALLET", validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "Invalid Solana wallet address");
    });

    it("non-canonical wallet format → { success: false, error: 'Invalid Solana wallet address' }", async () => {
      // Prepending '1' creates > 32 bytes → PublicKey constructor throws
      const nonCanonical = "1" + VALID_WALLET;
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(nonCanonical, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "Invalid Solana wallet address");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — Nonce validation
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — Nonce validation", () => {
    it("invalid nonce format (not 64 hex chars) → { success: false, error: 'Invalid nonce format' }", async () => {
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), "not-hex-nonce");
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "Invalid nonce format");
    });

    it("nonce too short (32 hex chars) → { success: false, error: 'Invalid nonce format' }", async () => {
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), "a".repeat(32));
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "Invalid nonce format");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — Signature validation
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — Signature validation", () => {
    it("signature not 64 bytes → { success: false, error: 'Signature must decode to 64 bytes' }", async () => {
      const shortSig = Buffer.alloc(32, 0xab).toString("base64");
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, shortSig, VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "Signature must decode to 64 bytes");
    });

    it("ed25519.verify returns false → { success: false, error: '署名の検証に失敗しました' }", async () => {
      mockEd25519VerifyResult = false;
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "署名の検証に失敗しました");
    });

    it("non-canonical base64 encoding → { success: false, error: 'Non-canonical base64 encoding' }", async () => {
      // Append a trailing space: Buffer.from decodes it (lenient) to 64 bytes,
      // but re-encoding differs from input → "Non-canonical base64 encoding"
      const canonical = Buffer.alloc(64, 0xab).toString("base64");
      const nonCanonical = canonical + " ";
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, nonCanonical, VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "Non-canonical base64 encoding");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — RPC results
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — RPC results", () => {
    it("rpcResult='ok' → { success: true }", async () => {
      mockRpcResult = { data: "ok", error: null };
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, true);
      // Verify RPC was called with correct function and arguments
      assert.ok(lastRpcArgs !== null, "rpc should have been called");
      assert.equal(lastRpcArgs!.fn, "consume_wallet_challenge");
      const rpcParams = lastRpcArgs!.args as Record<string, unknown>;
      assert.equal(rpcParams.p_wallet, VALID_WALLET, "rpc args should contain wallet");
      assert.equal(rpcParams.p_nonce, VALID_NONCE, "rpc args should contain nonce");
    });

    it("rpcResult='not_found' → { success: false, error: 'チャレンジが見つかりません…' }", async () => {
      mockRpcResult = { data: "not_found", error: null };
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "チャレンジが見つかりません。再度ウォレットを接続してください。");
    });

    it("rpcResult='conflict_wallet' → { success: false, error: 'このウォレットアドレスは既に…' }", async () => {
      mockRpcResult = { data: "conflict_wallet", error: null };
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "このウォレットアドレスは既に別のアカウントで使用されています");
    });

    it("rpcResult='user_not_found' → { success: false, error: 'プロフィールが見つかりません' }", async () => {
      mockRpcResult = { data: "user_not_found", error: null };
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "プロフィールが見つかりません");
    });

    it("rpcResult=unexpected value → { success: false, error: '予期しないエラーが発生しました' }", async () => {
      mockRpcResult = { data: "some_unknown_value", error: null };
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "予期しないエラーが発生しました");
    });

    it("rpcError → { success: false, error: 'ウォレット登録に失敗しました' }", async () => {
      mockRpcResult = { data: null, error: { message: "DB error" } };
      const { verifyWalletSignature } = getActions();
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "ウォレット登録に失敗しました");
    });
  });
});
