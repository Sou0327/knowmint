/**
 * T-7: me/wallet (SIWS) 統合テスト
 *
 * POST /api/v1/me/wallet/challenge — チャレンジ発行
 * POST /api/v1/me/wallet/verify   — 署名検証 + RPC consume
 *
 * Ed25519 署名生成に @noble/curves を使用（実モジュール）。
 * DB は createTableQueuedMockAdminClient でモック化。
 * 外部依存はすべてモック化しているため CI で実行可能 (Supabase CLI 不要)。
 */
import { expect, describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { ed25519 } from "@noble/curves/ed25519";
import {
  setupKnowledgeMocks,
  teardownKnowledgeMocks,
  mockAuth,
  createTableQueuedMockAdminClient,
  resetMockAuth,
} from "./helpers/supabase-mock";
import { buildSiwsMessage } from "@/lib/siws/message";

// ── route モジュール型 ────────────────────────────────────────────────────────

type PostHandler = (req: Request) => Promise<Response>;
type ChallengeModule = { POST: PostHandler };
type VerifyModule   = { POST: PostHandler };

// ── 定数 ──────────────────────────────────────────────────────────────────────

const USER_ID = "test-user-id";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockHelpers = require("./helpers/supabase-mock") as {
  resolveAlias: (p: string) => string;
  injectModule: (p: string, e: Record<string, unknown>) => void;
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer km_test" },
    body: JSON.stringify(body),
  });
}

/** @noble/curves で Ed25519 キーペアを生成 */
function generateKeyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey  = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/** PublicKey を base58 に変換 (Solana スタイル) */
function pubkeyToBase58(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  let result = "";
  while (n > 0n) {
    result = ALPHABET[Number(n % 58n)] + result;
    n = n / 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    result = "1" + result;
  }
  return result;
}

/** Ed25519 署名を hex にエンコード */
function signHex(message: string, privateKey: Uint8Array): string {
  const msgBytes = new TextEncoder().encode(message);
  const sig = ed25519.sign(msgBytes, privateKey);
  return Buffer.from(sig).toString("hex");
}

// ── challenge テスト ──────────────────────────────────────────────────────────

describe("POST /me/wallet/challenge — 統合テスト", () => {
  let POST: PostHandler;

  const { privateKey, publicKey } = generateKeyPair();
  const wallet = pubkeyToBase58(publicKey);

  function buildChallengeAdminClient() {
    return createTableQueuedMockAdminClient({
      wallet_challenges: [{ data: null, error: null }], // upsert
    });
  }

  beforeAll(() => {
    setupKnowledgeMocks();
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildChallengeAdminClient(),
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = (require("@/app/api/v1/me/wallet/challenge/route") as ChallengeModule).POST;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read", "write"] };
    // 各テストで新しい admin client を注入
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildChallengeAdminClient(),
    });
  });

  it("認証なし → 401", async () => {
    mockAuth.user = null;
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/challenge", { wallet }));
    expect(res.status).toBe(401);
  });

  it("wallet フィールドなし → 400", async () => {
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/challenge", {}));
    expect(res.status).toBe(400);
  });

  it("短すぎるウォレット文字列 → 400", async () => {
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/challenge", { wallet: "short" }));
    expect(res.status).toBe(400);
  });

  it("write パーミッションなし → 403", async () => {
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read"] };
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/challenge", { wallet }));
    expect(res.status).toBe(403);
  });

  it("valid wallet → 200 + { nonce, message, expires_at }", async () => {
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/challenge", { wallet }));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { nonce: string; message: string; expires_at: string } };
    expect(json.success).toBe(true);
    expect(typeof json.data.nonce).toBe("string");
    expect(json.data.nonce).toHaveLength(64); // 32 bytes hex
    expect(json.data.message).toContain(wallet);
    expect(typeof json.data.expires_at).toBe("string");
  });
});

// ── verify テスト ─────────────────────────────────────────────────────────────

describe("POST /me/wallet/verify — 統合テスト", () => {
  let POST: PostHandler;

  const { privateKey, publicKey } = generateKeyPair();
  const wallet = pubkeyToBase58(publicKey);
  // 64-char lowercase hex nonce
  const NONCE  = "a".repeat(64);

  const mockRpcResult = { data: "ok" as string, error: null as null | { message: string } };

  function buildVerifyAdminClient() {
    const base = { from: () => { throw new Error("from() should not be called in verify"); } };
    return {
      ...base,
      rpc: (_name: string, _args: unknown) => Promise.resolve(mockRpcResult),
    };
  }

  beforeAll(() => {
    setupKnowledgeMocks();
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildVerifyAdminClient(),
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = (require("@/app/api/v1/me/wallet/verify/route") as VerifyModule).POST;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read", "write"] };
    mockRpcResult.data = "ok";
    mockRpcResult.error = null;
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildVerifyAdminClient(),
    });
  });

  it("認証なし → 401", async () => {
    mockAuth.user = null;
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/verify", {
      wallet, signature: "a".repeat(128), nonce: NONCE,
    }));
    expect(res.status).toBe(401);
  });

  it("nonce が不正フォーマット (uppercase) → 400", async () => {
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/verify", {
      wallet, signature: "a".repeat(128), nonce: "A".repeat(64),
    }));
    expect(res.status).toBe(400);
  });

  it("nonce が短すぎる → 400", async () => {
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/verify", {
      wallet, signature: "a".repeat(128), nonce: "a".repeat(32),
    }));
    expect(res.status).toBe(400);
  });

  it("無効な署名 (ランダム hex) → 400", async () => {
    // 実際のウォレットで署名していないため検証失敗
    const fakeSignature = "f".repeat(128);
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/verify", {
      wallet, signature: fakeSignature, nonce: NONCE,
    }));
    expect(res.status).toBe(400);
  });

  it("正しい Ed25519 署名 → consume_wallet_challenge RPC 呼び出し → 200", async () => {
    // buildSiwsMessage と同じロジックでメッセージを構築し、実際の秘密鍵で署名
    const message   = buildSiwsMessage({ wallet, userId: USER_ID, nonce: NONCE });
    const signature = signHex(message, privateKey);

    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/verify", {
      wallet, signature, nonce: NONCE,
    }));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { verified: boolean; wallet: string } };
    expect(json.success).toBe(true);
    expect(json.data.verified).toBe(true);
    expect(json.data.wallet).toBe(wallet);
  });

  it("RPC が not_found → 400 (challenge 期限切れ/消費済み)", async () => {
    mockRpcResult.data = "not_found";
    const message   = buildSiwsMessage({ wallet, userId: USER_ID, nonce: NONCE });
    const signature = signHex(message, privateKey);
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/verify", {
      wallet, signature, nonce: NONCE,
    }));
    expect(res.status).toBe(400);
  });

  it("RPC が conflict_wallet → 409 (他アカウントに登録済み)", async () => {
    mockRpcResult.data = "conflict_wallet";
    const message   = buildSiwsMessage({ wallet, userId: USER_ID, nonce: NONCE });
    const signature = signHex(message, privateKey);
    const res = await POST(jsonRequest("http://localhost/api/v1/me/wallet/verify", {
      wallet, signature, nonce: NONCE,
    }));
    expect(res.status).toBe(409);
  });
});
