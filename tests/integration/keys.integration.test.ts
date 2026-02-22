/**
 * POST /api/v1/keys — 統合テスト
 *
 * before() でモックを require.cache に注入してからルートモジュールを require() する。
 * Supabase / Redis への実接続は不要。
 */
import * as assert from "node:assert/strict";
import { describe, it, before, after } from "mocha";
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

before(() => {
  setupKeysMocks();
  POST = (require("@/app/api/v1/keys/route") as RouteModule).POST;
});

after(() => {
  teardownKeysMocks();
});

// ── permissions バリデーション ────────────────────────────────────────────

describe("POST /api/v1/keys — permissions バリデーション", () => {
  it('["invalid_perm"] → 400', async () => {
    const res = await POST(
      makeRequest({ name: "test", permissions: ["invalid_perm"] })
    );
    assert.equal(res.status, 400);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };
    assert.equal(json.success, false);
    assert.equal(json.error.code, "bad_request");
  });

  it('["superuser"] → 400', async () => {
    const res = await POST(
      makeRequest({ name: "test", permissions: ["superuser"] })
    );
    assert.equal(res.status, 400);
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
    assert.ok(res.status >= 200 && res.status < 300);
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
    assert.ok(res.status >= 200 && res.status < 300);
  });
});

// ── name バリデーション ───────────────────────────────────────────────────

describe("POST /api/v1/keys — name バリデーション", () => {
  it("name 省略 → 400", async () => {
    const res = await POST(makeRequest({ permissions: ["read"] }));
    assert.equal(res.status, 400);
  });

  it('name: "" → 400', async () => {
    const res = await POST(makeRequest({ name: "", permissions: ["read"] }));
    assert.equal(res.status, 400);
  });
});

// ── expires_at バリデーション ─────────────────────────────────────────────

describe("POST /api/v1/keys — expires_at バリデーション", () => {
  it('"invalid_date" → 400', async () => {
    const res = await POST(
      makeRequest({ name: "test", expires_at: "invalid_date" })
    );
    assert.equal(res.status, 400);
  });

  it('"2020-01-01" (過去日) → 400', async () => {
    const res = await POST(
      makeRequest({ name: "test", expires_at: "2020-01-01" })
    );
    assert.equal(res.status, 400);
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
    assert.ok(res.status >= 200 && res.status < 300);
  });
});

// ── 認証失敗 ─────────────────────────────────────────────────────────────

describe("POST /api/v1/keys — 認証", () => {
  it("authUser が null → 401", async () => {
    const originalUser = mockAuth.user;
    mockAuth.user = null;
    try {
      const res = await POST(makeRequest({ name: "test" }));
      assert.equal(res.status, 401);
    } finally {
      mockAuth.user = originalUser;
    }
  });

  it("admin 権限なし (permissions: ['read']) → 403", async () => {
    const originalUser = mockAuth.user;
    mockAuth.user = { userId: "test-user-id", keyId: "test-key-id", permissions: ["read"] };
    try {
      const res = await POST(makeRequest({ name: "test" }));
      assert.equal(res.status, 403);
      const json = (await res.json()) as { success: boolean; error: { code: string } };
      assert.equal(json.error.code, "forbidden");
    } finally {
      mockAuth.user = originalUser;
    }
  });
});
