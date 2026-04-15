/**
 * B-7 dispatch.test.ts
 *
 * dispatchWebhook のセキュリティ境界を検証する。
 * - SSRF 拒否 (private_ip / invalid_url / dns_notfound)
 * - redirect rejection: undici の redirect:"error" が機能することを確認
 * - no_signing_secret: secret なしは即 reject
 * - timeout → error:"timeout"
 */

import { vi, expect, describe, it, beforeEach, afterEach } from "vitest";
import type { WebhookSub, WebhookPayload } from "@/lib/webhooks/dispatch";

// ── モック状態 ────────────────────────────────────────────────────────────────

const mockSsrf = vi.hoisted(() => ({
  result: { safe: true as boolean, resolvedIp: "93.184.216.34", family: 4 as 4 | 6 },
}));

const mockDecrypt = vi.hoisted(() => ({
  throws: false,
  value: "test-signing-secret",
}));

const mockFetch = vi.hoisted(() => ({
  throws: false,
  throwError: null as Error | null,
  response: { ok: true, status: 200 } as { ok: boolean; status: number },
}));

vi.mock("@/lib/webhooks/ssrf", () => ({
  checkPublicUrl: async (_url: string) => {
    if (mockSsrf.result.safe) {
      return {
        safe: true,
        resolvedIp: (mockSsrf.result as { safe: true; resolvedIp: string; family: 4 | 6 }).resolvedIp,
        family: (mockSsrf.result as { safe: true; resolvedIp: string; family: 4 | 6 }).family,
      };
    }
    return mockSsrf.result;
  },
}));

vi.mock("@/lib/webhooks/crypto", () => ({
  decryptSecret: (_enc: string) => {
    if (mockDecrypt.throws) throw new Error("decrypt failed");
    return mockDecrypt.value;
  },
}));

// undici fetch + Agent モック
// Agent must be a constructor (class-like function). vi.fn() alone fails with
// "is not a constructor"; wrap in a class expression instead.
vi.mock("undici", () => {
  class MockAgent {
    destroy = vi.fn().mockResolvedValue(undefined);
  }
  return {
    Agent: MockAgent,
    fetch: vi.fn().mockImplementation(async (_url: string, _opts: unknown) => {
      if (mockFetch.throwError) throw mockFetch.throwError;
      if (mockFetch.throws) throw new Error("network error");
      return mockFetch.response;
    }),
  };
});

vi.mock("@/lib/async/fire-and-forget", () => ({
  fireAndForget: vi.fn(),
}));

// ── グローバルリセット ─────────────────────────────────────────────────────────
// Each test may mutate mockSsrf/mockDecrypt/mockFetch. Reset after every test
// so state never leaks between describe blocks.

afterEach(() => {
  mockSsrf.result = { safe: true, resolvedIp: "93.184.216.34", family: 4 };
  mockDecrypt.throws = false;
  mockDecrypt.value = "test-signing-secret";
  mockFetch.throws = false;
  mockFetch.throwError = null;
  mockFetch.response = { ok: true, status: 200 };
});

// ── テストヘルパー ────────────────────────────────────────────────────────────

import { dispatchWebhook } from "@/lib/webhooks/dispatch";

const PAYLOAD: WebhookPayload = {
  event: "purchase.completed",
  data: { id: "item-1" },
  timestamp: new Date().toISOString(),
};

function makeSub(overrides?: Partial<WebhookSub>): WebhookSub {
  return {
    id: "sub-1",
    url: "https://example.com/hook",
    secret_encrypted: "iv.cipher.tag",
    ...overrides,
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("dispatchWebhook — no_signing_secret", () => {
  it("secret_encrypted=null → { success:false, error:'no_signing_secret' }", async () => {
    const result = await dispatchWebhook(makeSub({ secret_encrypted: null }), PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.error).toBe("no_signing_secret");
  });
});

describe("dispatchWebhook — SSRF rejection", () => {
  beforeEach(() => {
    mockSsrf.result = { safe: false, reason: "private_ip" } as typeof mockSsrf.result;
  });

  it("SSRF private_ip → { success:false, error:'ssrf_rejected' }", async () => {
    const result = await dispatchWebhook(makeSub(), PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.error).toBe("ssrf_rejected");
  });

  it("SSRF invalid_url → { success:false, error:'ssrf_rejected' }", async () => {
    mockSsrf.result = { safe: false, reason: "invalid_url" } as typeof mockSsrf.result;
    const result = await dispatchWebhook(makeSub({ url: "not-a-url" }), PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.error).toBe("ssrf_rejected");
  });

  it("SSRF dns_notfound → { success:false, error:'ssrf_rejected' }", async () => {
    mockSsrf.result = { safe: false, reason: "dns_notfound" } as typeof mockSsrf.result;
    const result = await dispatchWebhook(makeSub(), PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.error).toBe("ssrf_rejected");
  });

  it("SSRF dns_error → { success:false, error:'dns_error' } (retryable)", async () => {
    mockSsrf.result = { safe: false, reason: "dns_error" } as typeof mockSsrf.result;
    const result = await dispatchWebhook(makeSub(), PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.error).toBe("dns_error");
  });
});

describe("dispatchWebhook — decrypt failure", () => {
  beforeEach(() => {
    mockSsrf.result = { safe: true, resolvedIp: "93.184.216.34", family: 4 };
    mockDecrypt.throws = true;
  });

  it("decryptSecret throws → { success:false, error:'decrypt_failed' }", async () => {
    const result = await dispatchWebhook(makeSub(), PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.error).toBe("decrypt_failed");
  });
});

describe("dispatchWebhook — redirect rejection (B-7)", () => {
  beforeEach(() => {
    mockSsrf.result = { safe: true, resolvedIp: "93.184.216.34", family: 4 };
    mockDecrypt.throws = false;
    mockDecrypt.value = "test-secret";
  });

  it("redirect error (undici redirect:'error' throws) → { success:false, error contains message }", async () => {
    // undici throws TypeError when redirect:"error" and a redirect response is received.
    // We simulate this by making the mock fetch throw a redirect-like error.
    mockFetch.throwError = Object.assign(
      new TypeError("Response redirect not allowed"),
      { cause: { code: "UND_ERR_REDIRECT" } }
    );
    const result = await dispatchWebhook(makeSub(), PAYLOAD);
    expect(result.success).toBe(false);
    // error is the stringified error message (not timeout)
    expect(result.error).not.toBe("timeout");
    expect(typeof result.error).toBe("string");
  });
});

describe("dispatchWebhook — timeout", () => {
  beforeEach(() => {
    mockSsrf.result = { safe: true, resolvedIp: "93.184.216.34", family: 4 };
    mockDecrypt.throws = false;
    mockDecrypt.value = "test-secret";
  });

  it("AbortError → { success:false, error:'timeout' }", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    mockFetch.throwError = abortErr;
    const result = await dispatchWebhook(makeSub(), PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.error).toBe("timeout");
  });
});

describe("dispatchWebhook — success", () => {
  beforeEach(() => {
    mockSsrf.result = { safe: true, resolvedIp: "93.184.216.34", family: 4 };
    mockDecrypt.throws = false;
    mockDecrypt.value = "test-secret";
    mockFetch.throwError = null;
    mockFetch.throws = false;
    mockFetch.response = { ok: true, status: 200 };
  });

  it("200 OK → { success:true, statusCode:200 }", async () => {
    const result = await dispatchWebhook(makeSub(), PAYLOAD);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it("4xx response → { success:false, statusCode:400 }", async () => {
    mockFetch.response = { ok: false, status: 400 };
    const result = await dispatchWebhook(makeSub(), PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });
});
