import { vi, expect, describe, it, beforeEach } from "vitest";

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------
const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
// Valid canonical base58 Solana public key
const VALID_WALLET = "BuyerAddr11111111111111111111111111111111111";
const VALID_NONCE = "a".repeat(64);

// -----------------------------------------------------------------------
// Hoisted mock state
// -----------------------------------------------------------------------
const { state } = vi.hoisted(() => {
  const state = {
    mockUser: { id: "550e8400-e29b-41d4-a716-446655440000" } as { id: string } | null,
    mockUpsertResult: { error: null } as { error: unknown },
    mockRpcResult: { data: "ok" as unknown, error: null as unknown },
    lastUpsertArgs: null as { data: unknown; opts?: unknown } | null,
    lastRpcArgs: null as { fn: string; args: unknown } | null,
    mockEd25519VerifyResult: true,
  };
  return { state };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.mockUser },
        error: state.mockUser ? null : new Error("not authenticated"),
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => {
    const chain: Record<string, unknown> = {};
    const passthrough = () => chain;
    for (const m of [
      "from", "select", "eq", "neq", "in", "gte", "lte",
      "limit", "range", "order", "insert", "update", "delete",
    ]) {
      chain[m] = passthrough;
    }
    chain.upsert = (data: unknown, opts?: unknown) => {
      state.lastUpsertArgs = { data, opts };
      return Promise.resolve(state.mockUpsertResult);
    };
    chain.single = () => Promise.resolve({ data: null, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.rpc = (fn: string, args: unknown) => {
      state.lastRpcArgs = { fn, args };
      return Promise.resolve(state.mockRpcResult);
    };
    return chain;
  },
}));

vi.mock("@noble/curves/ed25519", async (importOriginal) => {
  const real = await importOriginal<typeof import("@noble/curves/ed25519")>();
  return {
    ...real,
    ed25519: {
      ...real.ed25519,
      verify: (_sig: Uint8Array, _msg: Uint8Array, _pub: Uint8Array) => state.mockEd25519VerifyResult,
    },
  };
});

import { requestWalletChallenge, verifyWalletSignature } from "@/app/actions/wallet";

// 64-byte base64 encoded signature (arbitrary bytes, structurally valid)
function validSig64Base64(): string {
  return Buffer.alloc(64, 0xab).toString("base64");
}

// -----------------------------------------------------------------------
// Test suite
// -----------------------------------------------------------------------
describe("wallet actions tests", () => {
  beforeEach(() => {
    state.mockUser = { id: USER_ID };
    state.mockUpsertResult = { error: null };
    state.mockRpcResult = { data: "ok", error: null };
    state.mockEd25519VerifyResult = true;
    state.lastUpsertArgs = null;
    state.lastRpcArgs = null;
  });

  // -----------------------------------------------------------------------
  // requestWalletChallenge — Auth
  // -----------------------------------------------------------------------
  describe("requestWalletChallenge() — Auth", () => {
    it("user=null → { success: false, error: '認証が必要です' }", async () => {
      state.mockUser = null;
      const result = await requestWalletChallenge(VALID_WALLET);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("認証が必要です");
    });
  });

  // -----------------------------------------------------------------------
  // requestWalletChallenge — Wallet validation
  // -----------------------------------------------------------------------
  describe("requestWalletChallenge() — Wallet validation", () => {
    it("invalid PublicKey → { success: false, error: 'Invalid Solana wallet address' }", async () => {
      const result = await requestWalletChallenge("not-a-valid-key!!");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Invalid Solana wallet address");
    });

    it("non-canonical base58 address → { success: false, error: 'Invalid Solana wallet address' }", async () => {
      // Prepending '1' (zero byte) to a valid key creates a string that decodes to more than
      // 32 bytes, causing PublicKey constructor to throw → "Invalid Solana wallet address"
      const nonCanonical = "1" + VALID_WALLET;
      const result = await requestWalletChallenge(nonCanonical);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Invalid Solana wallet address");
    });
  });

  // -----------------------------------------------------------------------
  // requestWalletChallenge — Upsert error
  // -----------------------------------------------------------------------
  describe("requestWalletChallenge() — Upsert error", () => {
    it("upsert error → { success: false, error: 'チャレンジの生成に失敗しました' }", async () => {
      state.mockUpsertResult = { error: { message: "db error" } };
      const result = await requestWalletChallenge(VALID_WALLET);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("チャレンジの生成に失敗しました");
    });
  });

  // -----------------------------------------------------------------------
  // requestWalletChallenge — Success
  // -----------------------------------------------------------------------
  describe("requestWalletChallenge() — Success", () => {
    it("returns { success: true, nonce: 64-char hex, message containing wallet + userId }", async () => {
      const result = await requestWalletChallenge(VALID_WALLET);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(/^[0-9a-f]{64}$/.test(result.nonce)).toBeTruthy();
        expect(result.message.includes(VALID_WALLET)).toBeTruthy();
        expect(result.message.includes(USER_ID)).toBeTruthy();
      }
      // Verify upsert was called with challenge data
      expect(state.lastUpsertArgs !== null).toBeTruthy();
      const upsertData = state.lastUpsertArgs!.data as Record<string, unknown>;
      expect(upsertData.wallet).toBe(VALID_WALLET);
      expect(upsertData.user_id).toBe(USER_ID);
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — Auth
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — Auth", () => {
    it("user=null → { success: false, error: '認証が必要です' }", async () => {
      state.mockUser = null;
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("認証が必要です");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — Wallet validation
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — Wallet validation", () => {
    it("invalid wallet → { success: false, error: 'Invalid Solana wallet address' }", async () => {
      const result = await verifyWalletSignature("INVALID!WALLET", validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Invalid Solana wallet address");
    });

    it("non-canonical wallet format → { success: false, error: 'Invalid Solana wallet address' }", async () => {
      // Prepending '1' creates > 32 bytes → PublicKey constructor throws
      const nonCanonical = "1" + VALID_WALLET;
      const result = await verifyWalletSignature(nonCanonical, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Invalid Solana wallet address");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — Nonce validation
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — Nonce validation", () => {
    it("invalid nonce format (not 64 hex chars) → { success: false, error: 'Invalid nonce format' }", async () => {
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), "not-hex-nonce");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Invalid nonce format");
    });

    it("nonce too short (32 hex chars) → { success: false, error: 'Invalid nonce format' }", async () => {
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), "a".repeat(32));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Invalid nonce format");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — Signature validation
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — Signature validation", () => {
    it("signature not 64 bytes → { success: false, error: 'Signature must decode to 64 bytes' }", async () => {
      const shortSig = Buffer.alloc(32, 0xab).toString("base64");
      const result = await verifyWalletSignature(VALID_WALLET, shortSig, VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Signature must decode to 64 bytes");
    });

    it("ed25519.verify returns false → { success: false, error: '署名の検証に失敗しました' }", async () => {
      state.mockEd25519VerifyResult = false;
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("署名の検証に失敗しました");
    });

    it("non-canonical base64 encoding → { success: false, error: 'Non-canonical base64 encoding' }", async () => {
      // Append a trailing space: Buffer.from decodes it (lenient) to 64 bytes,
      // but re-encoding differs from input → "Non-canonical base64 encoding"
      const canonical = Buffer.alloc(64, 0xab).toString("base64");
      const nonCanonical = canonical + " ";
      const result = await verifyWalletSignature(VALID_WALLET, nonCanonical, VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Non-canonical base64 encoding");
    });
  });

  // -----------------------------------------------------------------------
  // verifyWalletSignature — RPC results
  // -----------------------------------------------------------------------
  describe("verifyWalletSignature() — RPC results", () => {
    it("rpcResult='ok' → { success: true }", async () => {
      state.mockRpcResult = { data: "ok", error: null };
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(true);
      // Verify RPC was called with correct function and arguments
      expect(state.lastRpcArgs !== null).toBeTruthy();
      expect(state.lastRpcArgs!.fn).toBe("consume_wallet_challenge");
      const rpcParams = state.lastRpcArgs!.args as Record<string, unknown>;
      expect(rpcParams.p_wallet).toBe(VALID_WALLET);
      expect(rpcParams.p_nonce).toBe(VALID_NONCE);
    });

    it("rpcResult='not_found' → { success: false, error: 'チャレンジが見つかりません…' }", async () => {
      state.mockRpcResult = { data: "not_found", error: null };
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("チャレンジが見つかりません。再度ウォレットを接続してください。");
    });

    it("rpcResult='conflict_wallet' → { success: false, error: 'このウォレットアドレスは既に…' }", async () => {
      state.mockRpcResult = { data: "conflict_wallet", error: null };
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("このウォレットアドレスは既に別のアカウントで使用されています");
    });

    it("rpcResult='user_not_found' → { success: false, error: 'プロフィールが見つかりません' }", async () => {
      state.mockRpcResult = { data: "user_not_found", error: null };
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("プロフィールが見つかりません");
    });

    it("rpcResult=unexpected value → { success: false, error: '予期しないエラーが発生しました' }", async () => {
      state.mockRpcResult = { data: "some_unknown_value", error: null };
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("予期しないエラーが発生しました");
    });

    it("rpcError → { success: false, error: 'ウォレット登録に失敗しました' }", async () => {
      state.mockRpcResult = { data: null, error: { message: "DB error" } };
      const result = await verifyWalletSignature(VALID_WALLET, validSig64Base64(), VALID_NONCE);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("ウォレット登録に失敗しました");
    });
  });
});
