/**
 * POST /api/v1/keys — 統合テスト
 *
 * beforeAll() でモックを require.cache に注入してからルートモジュールを require() する。
 * Supabase / Redis への実接続は不要。
 */
import { expect, describe, it, beforeAll, afterAll } from "vitest";
import {
  setupKeysMocks,
  teardownKeysMocks,
  mockAuth,
  resetMockDb,
} from "./helpers/supabase-mock";

type PostHandler = (req: Request) => Promise<Response>;
type RouteModule = { POST: PostHandler };

let POST: PostHandler;

const BASE_URL = "http://localhost/api/v1/keys";

function makeRequest(body: unknown): Request {
  return new Request(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer km_testkey",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  setupKeysMocks();
  const mod = await import("@/app/api/v1/keys/route");
  POST = (mod as unknown as RouteModule).POST;
});

afterAll(() => {
  teardownKeysMocks();
});

// ── permissions バリデーション ────────────────────────────────────────────

describe("POST /api/v1/keys — permissions バリデーション", () => {
  it('["invalid_perm"] → 400', async () => {
    const res = await POST(
      makeRequest({ name: "test", permissions: ["invalid_perm"] })
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("bad_request");
  });

  it('["superuser"] → 400', async () => {
    const res = await POST(
      makeRequest({ name: "test", permissions: ["superuser"] })
    );
    expect(res.status).toBe(400);
  });

  it('["read"] → 2xx (insert が呼ばれる)', async () => {
    resetMockDb({
      singleData: {
        id: "new-key-id",
        name: "test",
        permissions: ["read"],
        created_at: "2026-02-22T00:00:00Z",
        expires_at: null,
      },
    });
    const res = await POST(makeRequest({ name: "test", permissions: ["read"] }));
    expect(res.status >= 200 && res.status < 300).toBeTruthy();
  });

  it('["read", "write"] → 2xx', async () => {
    resetMockDb({
      singleData: {
        id: "new-key-id",
        name: "test",
        permissions: ["read", "write"],
        created_at: "2026-02-22T00:00:00Z",
        expires_at: null,
      },
    });
    const res = await POST(
      makeRequest({ name: "test", permissions: ["read", "write"] })
    );
    expect(res.status >= 200 && res.status < 300).toBeTruthy();
  });
});

// ── name バリデーション ───────────────────────────────────────────────────

describe("POST /api/v1/keys — name バリデーション", () => {
  it("name 省略 → 400", async () => {
    const res = await POST(makeRequest({ permissions: ["read"] }));
    expect(res.status).toBe(400);
  });

  it('name: "" → 400', async () => {
    const res = await POST(makeRequest({ name: "", permissions: ["read"] }));
    expect(res.status).toBe(400);
  });
});

// ── expires_at バリデーション ─────────────────────────────────────────────

describe("POST /api/v1/keys — expires_at バリデーション", () => {
  it('"invalid_date" → 400', async () => {
    const res = await POST(
      makeRequest({ name: "test", expires_at: "invalid_date" })
    );
    expect(res.status).toBe(400);
  });

  it('"2020-01-01" (過去日) → 400', async () => {
    const res = await POST(
      makeRequest({ name: "test", expires_at: "2020-01-01" })
    );
    expect(res.status).toBe(400);
  });

  it("expires_at 省略 → 2xx", async () => {
    resetMockDb({
      singleData: {
        id: "new-key-id",
        name: "test",
        permissions: ["read"],
        created_at: "2026-02-22T00:00:00Z",
        expires_at: null,
      },
    });
    const res = await POST(makeRequest({ name: "test" }));
    expect(res.status >= 200 && res.status < 300).toBeTruthy();
  });
});

// ── 認証失敗 ─────────────────────────────────────────────────────────────

describe("POST /api/v1/keys — 認証", () => {
  it("authUser が null → 401", async () => {
    const originalUser = mockAuth.user;
    mockAuth.user = null;
    try {
      const res = await POST(makeRequest({ name: "test" }));
      expect(res.status).toBe(401);
    } finally {
      mockAuth.user = originalUser;
    }
  });

  it("admin 権限なし (permissions: ['read']) → 403", async () => {
    const originalUser = mockAuth.user;
    mockAuth.user = { userId: "test-user-id", keyId: "test-key-id", permissions: ["read"] };
    try {
      const res = await POST(makeRequest({ name: "test" }));
      expect(res.status).toBe(403);
      const json = (await res.json()) as { success: boolean; error: { code: string } };
      expect(json.error.code).toBe("forbidden");
    } finally {
      mockAuth.user = originalUser;
    }
  });
});
