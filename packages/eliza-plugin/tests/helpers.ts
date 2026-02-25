import type { IAgentRuntime, Memory, State, Content } from "@elizaos/core";
import { vi } from "vitest";

/** Minimal IAgentRuntime mock for testing */
export function createMockRuntime(settings: Record<string, string> = {}): IAgentRuntime {
  return {
    getSetting: vi.fn((key: string) => settings[key] ?? null),
  } as unknown as IAgentRuntime;
}

/** Create a Memory with given content fields */
export function createMessage(fields: Record<string, unknown> = {}): Memory {
  return {
    entityId: "00000000-0000-0000-0000-000000000001" as `${string}-${string}-${string}-${string}-${string}`,
    content: { text: "", ...fields } as Content,
  } as Memory;
}

/** Create a minimal State */
export function createState(): State {
  return {} as State;
}

/** Helper to create a mock Response */
export function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const bytes = new TextEncoder().encode(text);

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

/** Standard KM_API_KEY for tests */
export const TEST_API_KEY = "km_" + "a".repeat(64);
export const TEST_BASE_URL = "https://test.knowmint.shop";

/** Standard settings */
export const TEST_SETTINGS = {
  KM_API_KEY: TEST_API_KEY,
  KM_BASE_URL: TEST_BASE_URL,
};
