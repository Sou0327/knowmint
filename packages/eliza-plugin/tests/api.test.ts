import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfigFromRuntime, KmApiError, apiRequest, apiRequestPaginated, apiRequestWithPayment } from "../src/api.js";
import { createMockRuntime, mockResponse, TEST_API_KEY, TEST_BASE_URL, TEST_SETTINGS } from "./helpers.js";

describe("api", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadConfigFromRuntime", () => {
    it("returns config with valid settings", () => {
      const runtime = createMockRuntime(TEST_SETTINGS);
      const config = loadConfigFromRuntime(runtime);
      expect(config.apiKey).toBe(TEST_API_KEY);
      expect(config.baseUrl).toBe(TEST_BASE_URL);
    });

    it("throws if KM_API_KEY is missing", () => {
      const runtime = createMockRuntime({});
      expect(() => loadConfigFromRuntime(runtime)).toThrow("KM_API_KEY is not configured");
    });

    it("throws if KM_API_KEY has invalid format", () => {
      const runtime = createMockRuntime({ KM_API_KEY: "invalid_key" });
      expect(() => loadConfigFromRuntime(runtime)).toThrow("API key format is invalid");
    });

    it("uses default base URL when KM_BASE_URL not set", () => {
      const runtime = createMockRuntime({ KM_API_KEY: TEST_API_KEY });
      const config = loadConfigFromRuntime(runtime);
      expect(config.baseUrl).toBe("https://knowmint.shop");
    });

    it("rejects ftp:// base URL", () => {
      const runtime = createMockRuntime({ ...TEST_SETTINGS, KM_BASE_URL: "ftp://localhost:21" });
      expect(() => loadConfigFromRuntime(runtime)).toThrow("HTTP(S)");
    });

    it("rejects base URL with credentials", () => {
      const runtime = createMockRuntime({ ...TEST_SETTINGS, KM_BASE_URL: "https://user:pass@example.com" });
      expect(() => loadConfigFromRuntime(runtime)).toThrow("credentials");
    });

    it("allows http://localhost", () => {
      const runtime = createMockRuntime({ ...TEST_SETTINGS, KM_BASE_URL: "http://localhost:3000" });
      const config = loadConfigFromRuntime(runtime);
      expect(config.baseUrl).toBe("http://localhost:3000");
    });

    it("rejects http:// for non-localhost", () => {
      const runtime = createMockRuntime({ ...TEST_SETTINGS, KM_BASE_URL: "http://example.com" });
      expect(() => loadConfigFromRuntime(runtime)).toThrow("HTTPS");
    });
  });

  describe("apiRequest", () => {
    const config = { apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL };

    it("sends GET with auth header", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ success: true, data: { id: "1" } }));

      const result = await apiRequest<{ id: string }>(config, "/api/v1/test");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${TEST_BASE_URL}/api/v1/test`);
      expect(init.method).toBe("GET");
      expect(init.headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
      expect(result).toEqual({ id: "1" });
    });

    it("sends POST with JSON body", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ success: true, data: { ok: true } }));

      await apiRequest(config, "/api/v1/test", "POST", { key: "value" });

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(init.body).toBe('{"key":"value"}');
    });

    it("throws KmApiError on non-ok response", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ error: { message: "Not found", code: "NOT_FOUND" } }, 404),
      );

      try {
        await apiRequest(config, "/api/v1/missing");
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(KmApiError);
        expect((e as KmApiError).status).toBe(404);
        expect((e as KmApiError).message).toBe("Not found");
        expect((e as KmApiError).code).toBe("NOT_FOUND");
      }
    });

    it("throws KmApiError on unexpected response shape", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ success: false }));

      await expect(apiRequest(config, "/api/v1/test")).rejects.toThrow("Unexpected API response shape");
    });

    it("rejects oversized response body", async () => {
      const huge = "x".repeat(3 * 1024 * 1024); // 3MB
      fetchSpy.mockResolvedValueOnce(mockResponse(huge));

      await expect(apiRequest(config, "/api/v1/test")).rejects.toThrow("too large");
    });

    it("rejects oversized Content-Length header", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse("small", 200, { "content-length": "10000000" }),
      );

      await expect(apiRequest(config, "/api/v1/test")).rejects.toThrow("too large");
    });
  });

  describe("apiRequestPaginated", () => {
    const config = { apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL };

    it("returns data and pagination", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ success: true, data: [{ id: "1" }], pagination: { page: 1 } }),
      );

      const result = await apiRequestPaginated<{ id: string }>(config, "/api/v1/items?page=1");

      expect(result.data).toEqual([{ id: "1" }]);
      expect(result.pagination).toEqual({ page: 1 });
    });
  });

  describe("apiRequestWithPayment", () => {
    const config = { apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL };

    it("returns data on 200", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ success: true, data: { content: "hello" } }),
      );

      const result = await apiRequestWithPayment<{ content: string }>(config, "/api/v1/content");
      expect(result).toEqual({ content: "hello" });
    });

    it("returns PaymentRequiredResponse on 402", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ x402Version: 1, accepts: [{ scheme: "exact" }], error: "Payment needed" }, 402),
      );

      const result = await apiRequestWithPayment(config, "/api/v1/content");
      expect(result).toEqual({
        payment_required: true,
        x402Version: 1,
        accepts: [{ scheme: "exact" }],
        error: "Payment needed",
      });
    });

    it("sends X-PAYMENT header when provided", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ success: true, data: { content: "paid" } }),
      );

      await apiRequestWithPayment(config, "/api/v1/content", { "X-PAYMENT": "proof123" });

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers["X-PAYMENT"]).toBe("proof123");
    });
  });
});
