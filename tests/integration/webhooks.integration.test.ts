/**
 * POST /api/v1/webhooks — 統合テスト
 *
 * SSRF 保護は実モジュール（ssrf.ts）をそのまま使用し、
 * IP リテラル URL で DNS 解決不要にテストする。
 * withApiAuth はモック化。
 */
import { expect, describe, it, beforeAll, afterAll } from "vitest";
import {
  setupWebhooksMocks,
  teardownWebhooksMocks,
  resetMockDb,
  mockAuth,
} from "./helpers/supabase-mock";

type PostHandler = (req: Request) => Promise<Response>;
type RouteModule = { POST: PostHandler };

let POST: PostHandler;

const BASE_URL = "http://localhost/api/v1/webhooks";

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
  setupWebhooksMocks();
  const mod = await import("@/app/api/v1/webhooks/route");
  POST = (mod as unknown as RouteModule).POST;
});

afterAll(() => {
  teardownWebhooksMocks();
});

// ── SSRF 保護 ─────────────────────────────────────────────────────────────

describe("POST /api/v1/webhooks — SSRF 保護", () => {
  it('"https://127.0.0.1/hook" → 400 (loopback)', async () => {
    const res = await POST(
      makeRequest({
        url: "https://127.0.0.1/hook",
        events: ["purchase.completed"],
      })
    );
    expect(res.status).toBe(400);
  });

  it('"https://192.168.1.1/hook" → 400 (private IP)', async () => {
    const res = await POST(
      makeRequest({
        url: "https://192.168.1.1/hook",
        events: ["purchase.completed"],
      })
    );
    expect(res.status).toBe(400);
  });

  it('"https://10.0.0.1/hook" → 400 (private IP)', async () => {
    const res = await POST(
      makeRequest({
        url: "https://10.0.0.1/hook",
        events: ["purchase.completed"],
      })
    );
    expect(res.status).toBe(400);
  });
});

// ── events バリデーション ─────────────────────────────────────────────────

describe("POST /api/v1/webhooks — events バリデーション", () => {
  it('["invalid.event"] → 400', async () => {
    const res = await POST(
      makeRequest({
        url: "https://example.com/hook",
        events: ["invalid.event"],
      })
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(json.error.code).toBe("bad_request");
  });

  it("events: [] (空配列) → 400", async () => {
    const res = await POST(
      makeRequest({ url: "https://example.com/hook", events: [] })
    );
    expect(res.status).toBe(400);
  });

  it("events 省略 → 400", async () => {
    const res = await POST(makeRequest({ url: "https://example.com/hook" }));
    expect(res.status).toBe(400);
  });
});

// ── url バリデーション ────────────────────────────────────────────────────

describe("POST /api/v1/webhooks — url バリデーション", () => {
  it("url 省略 → 400", async () => {
    const res = await POST(
      makeRequest({ events: ["purchase.completed"] })
    );
    expect(res.status).toBe(400);
  });

  it('"http://" (非 HTTPS) → 400', async () => {
    const res = await POST(
      makeRequest({
        url: "http://example.com/hook",
        events: ["purchase.completed"],
      })
    );
    expect(res.status).toBe(400);
  });
});

// ── 権限不足 ──────────────────────────────────────────────────────────────

describe("POST /api/v1/webhooks — 権限チェック", () => {
  it("write 権限なし (permissions: ['read']) → 403", async () => {
    const originalUser = mockAuth.user;
    mockAuth.user = { userId: "test-user-id", keyId: "test-key-id", permissions: ["read"] };
    try {
      const res = await POST(
        makeRequest({ url: "https://8.8.8.8/hook", events: ["purchase.completed"] })
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as { success: boolean; error: { code: string } };
      expect(json.error.code).toBe("forbidden");
    } finally {
      mockAuth.user = originalUser;
    }
  });
});

// ── 正常系（DNS 解決が必要なため example.com は使えない点に注意）
// SSRF チェックが DNS 解決を行うため、公開 IP リテラルで代替テスト ─────────

describe("POST /api/v1/webhooks — 正常系（モック DB）", () => {
  it("有効な public IP + valid events → 2xx", async () => {
    resetMockDb({
      singleData: {
        id: "mock-webhook-id",
        url: "https://8.8.8.8/hook",
        events: ["purchase.completed"],
        active: true,
        created_at: "2026-02-22T00:00:00Z",
      },
    });
    // 8.8.8.8 は DNS 不要のパブリック IP リテラル
    const res = await POST(
      makeRequest({
        url: "https://8.8.8.8/hook",
        events: ["purchase.completed"],
      })
    );
    expect(res.status >= 200 && res.status < 300).toBeTruthy();
  });
});
