import * as assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "mocha";
import type { WebhookSub, WebhookPayload } from "@/lib/webhooks/dispatch";

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------
const mockDispatch = {
  results: [] as Array<{ success: boolean; statusCode?: number; error?: string }>,
  callCount: 0,
};

let capturedDelays: number[] = [];
const originalSetTimeout = globalThis.setTimeout;

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

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
before(() => {
  // 1. Inject mock for the dispatch module
  const dispatchPath = require.resolve("@/lib/webhooks/dispatch");
  require.cache[dispatchPath] = {
    id: dispatchPath,
    filename: dispatchPath,
    loaded: true,
    exports: {
      dispatchWebhook: async (_sub: unknown, _payload: unknown) => {
        mockDispatch.callCount++;
        return mockDispatch.results.shift() ?? { success: false, error: "no_more_results" };
      },
    },
    parent: null,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;

  // 2. Clear retry module cache so it picks up the mocked dispatch
  try {
    delete require.cache[require.resolve("@/lib/webhooks/retry")];
  } catch {
    // ignore
  }

  // 3. Stub setTimeout to skip real delays
  (globalThis as unknown as Record<string, unknown>).setTimeout = (fn: () => void, ms: number) => {
    capturedDelays.push(ms);
    fn(); // execute immediately
    return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
  };
});

after(() => {
  // Restore globals and module cache
  globalThis.setTimeout = originalSetTimeout;
  try {
    delete require.cache[require.resolve("@/lib/webhooks/dispatch")];
  } catch {
    // ignore
  }
  try {
    delete require.cache[require.resolve("@/lib/webhooks/retry")];
  } catch {
    // ignore
  }
});

beforeEach(() => {
  mockDispatch.results = [];
  mockDispatch.callCount = 0;
  capturedDelays = [];
});

// ---------------------------------------------------------------------------
// Helper: load retry module fresh each call (cache already cleared in before())
// ---------------------------------------------------------------------------
function getDispatchWithRetry(): typeof import("@/lib/webhooks/retry").dispatchWithRetry {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/webhooks/retry").dispatchWithRetry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("dispatchWithRetry()", () => {
  describe("成功ケース", () => {
    it("1回目成功 → callCount=1, capturedDelays=[]", async () => {
      mockDispatch.results = [{ success: true }];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 1);
      assert.deepEqual(capturedDelays, []);
    });

    it("1回失敗 → 2回目成功 → callCount=2, delays.length=1, delays[0] ≈ 1000ms", async () => {
      mockDispatch.results = [{ success: false, statusCode: 500 }, { success: true }];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 2);
      assert.equal(capturedDelays.length, 1);
      assert.ok(
        capturedDelays[0] >= 900 && capturedDelays[0] <= 1100,
        `Expected delay ≈ 1000ms, got ${capturedDelays[0]}ms`
      );
    });

    it("2回失敗 → 3回目成功 → callCount=3, delays.length=2, delays[0] ≈ 1000ms, delays[1] ≈ 2000ms", async () => {
      mockDispatch.results = [
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
        { success: true },
      ];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 3);
      assert.equal(capturedDelays.length, 2);
      assert.ok(
        capturedDelays[0] >= 900 && capturedDelays[0] <= 1100,
        `Expected delays[0] ≈ 1000ms, got ${capturedDelays[0]}ms`
      );
      assert.ok(
        capturedDelays[1] >= 1800 && capturedDelays[1] <= 2200,
        `Expected delays[1] ≈ 2000ms, got ${capturedDelays[1]}ms`
      );
    });
  });

  describe("永続エラー（リトライなし）", () => {
    it('error: "no_signing_secret" → 1回で終了', async () => {
      mockDispatch.results = [{ success: false, error: "no_signing_secret" }];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 1);
      assert.deepEqual(capturedDelays, []);
    });

    it('error: "decrypt_failed" → 1回で終了', async () => {
      mockDispatch.results = [{ success: false, error: "decrypt_failed" }];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 1);
      assert.deepEqual(capturedDelays, []);
    });

    it('error: "ssrf_rejected" → 1回で終了', async () => {
      mockDispatch.results = [{ success: false, error: "ssrf_rejected" }];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 1);
      assert.deepEqual(capturedDelays, []);
    });

    it("statusCode: 400 → 1回で終了", async () => {
      mockDispatch.results = [{ success: false, statusCode: 400 }];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 1);
      assert.deepEqual(capturedDelays, []);
    });

    it("statusCode: 403 → 1回で終了", async () => {
      mockDispatch.results = [{ success: false, statusCode: 403 }];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 1);
      assert.deepEqual(capturedDelays, []);
    });

    it("statusCode: 422 → 1回で終了", async () => {
      mockDispatch.results = [{ success: false, statusCode: 422 }];
      await getDispatchWithRetry()(dummySub, dummyPayload);
      assert.equal(mockDispatch.callCount, 1);
      assert.deepEqual(capturedDelays, []);
    });
  });

  describe("リトライ対象エラー", () => {
    it("statusCode: 429 → リトライする (maxRetries=2 で callCount=2)", async () => {
      mockDispatch.results = [{ success: false, statusCode: 429 }, { success: true }];
      await getDispatchWithRetry()(dummySub, dummyPayload, 2);
      assert.equal(mockDispatch.callCount, 2);
    });

    it("statusCode: 500 → リトライする", async () => {
      mockDispatch.results = [{ success: false, statusCode: 500 }, { success: true }];
      await getDispatchWithRetry()(dummySub, dummyPayload, 2);
      assert.equal(mockDispatch.callCount, 2);
    });

    it("statusCode: 503 → リトライする", async () => {
      mockDispatch.results = [{ success: false, statusCode: 503 }, { success: true }];
      await getDispatchWithRetry()(dummySub, dummyPayload, 2);
      assert.equal(mockDispatch.callCount, 2);
    });

    it('error: "timeout" → リトライする', async () => {
      mockDispatch.results = [{ success: false, error: "timeout" }, { success: true }];
      await getDispatchWithRetry()(dummySub, dummyPayload, 2);
      assert.equal(mockDispatch.callCount, 2);
    });
  });

  describe("全試行失敗", () => {
    it("maxRetries=3 全失敗 → callCount=3, delays.length=2", async () => {
      mockDispatch.results = [
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
      ];
      await getDispatchWithRetry()(dummySub, dummyPayload, 3);
      assert.equal(mockDispatch.callCount, 3);
      assert.equal(capturedDelays.length, 2);
    });
  });

  describe("maxRetries カスタマイズ", () => {
    it("maxRetries=1 → callCount=1, delays=[]", async () => {
      mockDispatch.results = [{ success: false, statusCode: 500 }];
      await getDispatchWithRetry()(dummySub, dummyPayload, 1);
      assert.equal(mockDispatch.callCount, 1);
      assert.deepEqual(capturedDelays, []);
    });
  });

  describe("バックオフ順序", () => {
    it("delays[1] > delays[0] (指数バックオフ確認)", async () => {
      mockDispatch.results = [
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
        { success: false, statusCode: 503 },
      ];
      await getDispatchWithRetry()(dummySub, dummyPayload, 3);
      assert.equal(capturedDelays.length, 2, "3回失敗で2回の遅延が発生するはず");
      assert.ok(
        capturedDelays[1] > capturedDelays[0],
        `Expected delays[1](${capturedDelays[1]}) > delays[0](${capturedDelays[0]})`
      );
    });
  });
});
