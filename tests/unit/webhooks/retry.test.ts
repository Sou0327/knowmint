import { vi, expect, describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import type { WebhookSub, WebhookPayload } from "@/lib/webhooks/dispatch";

// ---------------------------------------------------------------------------
// Mock state (hoisted so mock factories can access it)
// ---------------------------------------------------------------------------
const mockDispatch = vi.hoisted(() => ({
  results: [] as Array<{ success: boolean; statusCode?: number; error?: string }>,
  callCount: 0,
}));

vi.mock("@/lib/webhooks/dispatch", () => ({
  dispatchWebhook: async (_sub: unknown, _payload: unknown) => {
    mockDispatch.callCount++;
    return mockDispatch.results.shift() ?? { success: false, error: "no_more_results" };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: () => ({
      insert: () => ({
        then: (_onFulfilled: unknown, _onRejected: unknown) => Promise.resolve(),
      }),
    }),
  }),
}));

import { dispatchWithRetry } from "@/lib/webhooks/retry";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const dummySub: WebhookSub = {
  id: "test-webhook-id",
  url: "https://example.com/hook",
  secret_encrypted: "enc:aes256gcm:...",
};

const dummyPayload: WebhookPayload = {
  event: "purchase.completed",
  data: { id: "test-id" },
  timestamp: "2026-02-22T00:00:00Z",
};

let capturedDelays: number[] = [];
const originalSetTimeout = globalThis.setTimeout;

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeAll(() => {
  // 3. Stub setTimeout to skip real delays
  (globalThis as unknown as Record<string, unknown>).setTimeout = (fn: () => void, ms: number) => {
    capturedDelays.push(ms);
    fn(); // execute immediately
    return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
  };
});

afterAll(() => {
  globalThis.setTimeout = originalSetTimeout;
});

beforeEach(() => {
  mockDispatch.results = [];
  mockDispatch.callCount = 0;
  capturedDelays = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("dispatchWithRetry()", () => {
  describe("成功ケース", () => {
    it("1回目成功 → callCount=1, capturedDelays=[]", async () => {
      mockDispatch.results = [{ success: true }];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(1);
      expect(capturedDelays).toEqual([]);
    });

    it("1回失敗 → 2回目成功 → callCount=2, delays.length=1, delays[0] ≈ 1000ms", async () => {
      mockDispatch.results = [{ success: false, statusCode: 500 }, { success: true }];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(2);
      expect(capturedDelays.length).toBe(1);
      expect(
        capturedDelays[0] >= 900 && capturedDelays[0] <= 1100,
      ).toBeTruthy();
    });

    it("2回失敗 → 3回目成功 → callCount=3, delays.length=2, delays[0] ≈ 1000ms, delays[1] ≈ 2000ms", async () => {
      mockDispatch.results = [
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
        { success: true },
      ];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(3);
      expect(capturedDelays.length).toBe(2);
      expect(
        capturedDelays[0] >= 900 && capturedDelays[0] <= 1100,
      ).toBeTruthy();
      expect(
        capturedDelays[1] >= 1800 && capturedDelays[1] <= 2200,
      ).toBeTruthy();
    });
  });

  describe("永続エラー（リトライなし）", () => {
    it('error: "no_signing_secret" → 1回で終了', async () => {
      mockDispatch.results = [{ success: false, error: "no_signing_secret" }];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(1);
      expect(capturedDelays).toEqual([]);
    });

    it('error: "decrypt_failed" → 1回で終了', async () => {
      mockDispatch.results = [{ success: false, error: "decrypt_failed" }];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(1);
      expect(capturedDelays).toEqual([]);
    });

    it('error: "ssrf_rejected" → 1回で終了', async () => {
      mockDispatch.results = [{ success: false, error: "ssrf_rejected" }];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(1);
      expect(capturedDelays).toEqual([]);
    });

    it("statusCode: 400 → 1回で終了", async () => {
      mockDispatch.results = [{ success: false, statusCode: 400 }];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(1);
      expect(capturedDelays).toEqual([]);
    });

    it("statusCode: 403 → 1回で終了", async () => {
      mockDispatch.results = [{ success: false, statusCode: 403 }];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(1);
      expect(capturedDelays).toEqual([]);
    });

    it("statusCode: 422 → 1回で終了", async () => {
      mockDispatch.results = [{ success: false, statusCode: 422 }];
      await dispatchWithRetry(dummySub, dummyPayload);
      expect(mockDispatch.callCount).toBe(1);
      expect(capturedDelays).toEqual([]);
    });
  });

  describe("リトライ対象エラー", () => {
    it("statusCode: 429 → リトライする (maxRetries=2 で callCount=2)", async () => {
      mockDispatch.results = [{ success: false, statusCode: 429 }, { success: true }];
      await dispatchWithRetry(dummySub, dummyPayload, 2);
      expect(mockDispatch.callCount).toBe(2);
    });

    it("statusCode: 500 → リトライする", async () => {
      mockDispatch.results = [{ success: false, statusCode: 500 }, { success: true }];
      await dispatchWithRetry(dummySub, dummyPayload, 2);
      expect(mockDispatch.callCount).toBe(2);
    });

    it("statusCode: 503 → リトライする", async () => {
      mockDispatch.results = [{ success: false, statusCode: 503 }, { success: true }];
      await dispatchWithRetry(dummySub, dummyPayload, 2);
      expect(mockDispatch.callCount).toBe(2);
    });

    it('error: "timeout" → リトライする', async () => {
      mockDispatch.results = [{ success: false, error: "timeout" }, { success: true }];
      await dispatchWithRetry(dummySub, dummyPayload, 2);
      expect(mockDispatch.callCount).toBe(2);
    });
  });

  describe("全試行失敗", () => {
    it("maxRetries=3 全失敗 → callCount=3, delays.length=2", async () => {
      mockDispatch.results = [
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
      ];
      await dispatchWithRetry(dummySub, dummyPayload, 3);
      expect(mockDispatch.callCount).toBe(3);
      expect(capturedDelays.length).toBe(2);
    });
  });

  describe("maxRetries カスタマイズ", () => {
    it("maxRetries=1 → callCount=1, delays=[]", async () => {
      mockDispatch.results = [{ success: false, statusCode: 500 }];
      await dispatchWithRetry(dummySub, dummyPayload, 1);
      expect(mockDispatch.callCount).toBe(1);
      expect(capturedDelays).toEqual([]);
    });
  });

  describe("バックオフ順序", () => {
    it("delays[1] > delays[0] (指数バックオフ確認)", async () => {
      mockDispatch.results = [
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
      ];
      await dispatchWithRetry(dummySub, dummyPayload, 3);
      expect(capturedDelays.length).toBe(2);
      expect(capturedDelays[1] > capturedDelays[0]).toBeTruthy();
    });
  });
});
