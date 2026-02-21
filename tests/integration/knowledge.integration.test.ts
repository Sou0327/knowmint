/**
 * POST /api/v1/knowledge — 統合テスト
 *
 * withApiAuth をモック化してルートのバリデーションロジックを直接テストする。
 * Supabase への実接続は不要。
 */
import * as assert from "node:assert/strict";
import { describe, it, before, after } from "mocha";
import {
  setupKnowledgeMocks,
  teardownKnowledgeMocks,
  resetMockDb,
} from "./helpers/supabase-mock";

type PostHandler = (req: Request) => Promise<Response>;
type RouteModule = { POST: PostHandler };

let POST: PostHandler;

const BASE_URL = "http://localhost/api/v1/knowledge";

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
  setupKnowledgeMocks();
  POST = (require("@/app/api/v1/knowledge/route") as RouteModule).POST;
});

after(() => {
  teardownKnowledgeMocks();
});

// ── full_content サイズバリデーション ─────────────────────────────────────

describe("POST /api/v1/knowledge — full_content サイズ", () => {
  it("500,001 文字 → 400", async () => {
    const res = await POST(
      makeRequest({
        title: "Test",
        description: "Desc",
        content_type: "prompt",
        full_content: "x".repeat(500_001),
      })
    );
    assert.equal(res.status, 400);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };
    assert.equal(json.success, false);
    assert.equal(json.error.code, "bad_request");
  });

  it("500,000 文字 → 2xx (Supabase insert が呼ばれる)", async () => {
    resetMockDb();
    const res = await POST(
      makeRequest({
        title: "Test",
        description: "Desc",
        content_type: "prompt",
        full_content: "x".repeat(500_000),
      })
    );
    assert.ok(res.status >= 200 && res.status < 300);
  });
});

// ── content_type バリデーション ───────────────────────────────────────────

describe("POST /api/v1/knowledge — content_type バリデーション", () => {
  it('"invalid" → 400', async () => {
    const res = await POST(
      makeRequest({
        title: "Test",
        description: "Desc",
        content_type: "invalid",
      })
    );
    assert.equal(res.status, 400);
  });

  it('"prompt" → 2xx', async () => {
    resetMockDb();
    const res = await POST(
      makeRequest({
        title: "Test",
        description: "Desc",
        content_type: "prompt",
      })
    );
    assert.ok(res.status >= 200 && res.status < 300);
  });

  it('"tool_def" → 2xx', async () => {
    resetMockDb();
    const res = await POST(
      makeRequest({
        title: "Test",
        description: "Desc",
        content_type: "tool_def",
      })
    );
    assert.ok(res.status >= 200 && res.status < 300);
  });
});

// ── 必須フィールドバリデーション ─────────────────────────────────────────

describe("POST /api/v1/knowledge — 必須フィールド", () => {
  it("title 省略 → 400", async () => {
    const res = await POST(
      makeRequest({ description: "Desc", content_type: "prompt" })
    );
    assert.equal(res.status, 400);
  });

  it("description 省略 → 400", async () => {
    const res = await POST(
      makeRequest({ title: "Test", content_type: "prompt" })
    );
    assert.equal(res.status, 400);
  });
});
