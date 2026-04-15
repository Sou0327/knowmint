/**
 * T-6: favorites / feedback / report 統合テスト
 *
 * - favorites: UUID_RE バリデーション・認可フィルタ確認
 * - feedback:  .neq("seller_id", userId) が実際に呼ばれることを expectedCalls で検証
 * - report:    自己報告禁止・published 以外は 404
 *
 * 外部依存はすべてモック化しているため CI で実行可能 (Supabase CLI 不要)。
 */
import { expect, describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupKnowledgeMocks,
  teardownKnowledgeMocks,
  mockAuth,
  mockDb,
  createTableQueuedMockAdminClient,
  resetMockAuth,
} from "./helpers/supabase-mock";

// ── route モジュール型 ────────────────────────────────────────────────────────

type GetHandler  = (req: Request) => Promise<Response>;
type PostHandler = (req: Request) => Promise<Response>;
type DelHandler  = (req: Request) => Promise<Response>;
type FeedbackPostHandler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
type ReportPostHandler   = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

type FavoritesModule = { GET: GetHandler; POST: PostHandler; DELETE: DelHandler };
type FeedbackModule  = { POST: FeedbackPostHandler };
type ReportModule    = { POST: ReportPostHandler };

// ── 定数 ──────────────────────────────────────────────────────────────────────

const USER_ID   = "test-user-id";
const SELLER_ID = "seller-user-id";
const ITEM_ID   = "11111111-2222-3333-4444-555555555555";
const TX_ID     = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer km_test" },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockHelpers = require("./helpers/supabase-mock") as {
  resolveAlias: (p: string) => string;
  injectModule: (p: string, e: Record<string, unknown>) => void;
};

// ── favorites テスト ──────────────────────────────────────────────────────────

describe("favorites API — 統合テスト", () => {
  let GET:    GetHandler;
  let POST:   PostHandler;
  let DELETE: DelHandler;

  beforeAll(() => {
    setupKnowledgeMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/app/api/v1/favorites/route") as FavoritesModule;
    GET    = mod.GET;
    POST   = mod.POST;
    DELETE = mod.DELETE;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read", "write"] };
    mockDb.directData = [];
    mockDb.directError = null;
    mockDb.singleData = null;
    mockDb.singleError = null;
  });

  it("GET favorites — 認証なし → 401", async () => {
    mockAuth.user = null;
    const res = await GET(new Request("http://localhost/api/v1/favorites", {
      headers: { Authorization: "Bearer km_test" },
    }));
    expect(res.status).toBe(401);
  });

  it("GET favorites — 認証あり → 200", async () => {
    mockDb.directData = [];
    const res = await GET(new Request("http://localhost/api/v1/favorites", {
      headers: { Authorization: "Bearer km_test" },
    }));
    expect(res.status).toBe(200);
  });

  it("POST favorites — invalid UUID → 400", async () => {
    const res = await POST(jsonRequest(
      "http://localhost/api/v1/favorites",
      "POST",
      { knowledge_item_id: "not-a-uuid" }
    ));
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("POST favorites — missing knowledge_item_id → 400", async () => {
    const res = await POST(jsonRequest(
      "http://localhost/api/v1/favorites",
      "POST",
      {}
    ));
    expect(res.status).toBe(400);
  });

  it("DELETE favorites — invalid UUID → 400", async () => {
    const res = await DELETE(jsonRequest(
      "http://localhost/api/v1/favorites",
      "DELETE",
      { knowledge_item_id: "not-a-uuid" }
    ));
    expect(res.status).toBe(400);
  });
});

// ── feedback テスト ───────────────────────────────────────────────────────────

describe("feedback API — 統合テスト", () => {
  let POST: FeedbackPostHandler;

  function buildFeedbackAdminClient(hasTx: boolean, hasExisting: boolean) {
    const tables: Record<string, Array<{ data: unknown; expectedCalls?: Array<{ method: string; args: unknown[] }> }>> = {
      transactions: [
        {
          data: hasTx ? { id: TX_ID } : null,
          // T-6 核心: .neq("seller_id", userId) が呼ばれることを expectedCalls で保証
          expectedCalls: [{ method: "neq", args: ["seller_id", USER_ID] }],
        },
      ],
    };
    if (hasTx) {
      tables["knowledge_feedbacks"] = [
        { data: hasExisting ? { id: "existing-feedback-id" } : null },
        { data: null, error: null }, // INSERT
      ];
    }
    return {
      ...createTableQueuedMockAdminClient(tables),
      rpc: (_name: string, _args: unknown) => Promise.resolve({ error: null }),
    };
  }

  beforeAll(() => {
    setupKnowledgeMocks();

    mockHelpers.injectModule(mockHelpers.resolveAlias("next/server"), {
      after: (fn: () => unknown) => { fn(); },
    });
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/webhooks/events"), {
      fireWebhookEvent: async () => {},
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = (require("@/app/api/v1/knowledge/[id]/feedback/route") as FeedbackModule).POST;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read", "write"] };
  });

  it("useful フィールドなし → 400", async () => {
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/feedback`, "POST", {}),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(400);
  });

  it("useful が文字列 → 400", async () => {
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/feedback`, "POST", { useful: "yes" }),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(400);
  });

  it("confirmed purchase なし → 403 (+ .neq('seller_id') 呼び出し検証)", async () => {
    // .neq("seller_id", USER_ID) が実際に呼ばれることを expectedCalls で保証
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildFeedbackAdminClient(false, false),
    });
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/feedback`, "POST", { useful: true }),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(403);
  });

  it("既存フィードバックあり → 409", async () => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildFeedbackAdminClient(true, true),
    });
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/feedback`, "POST", { useful: true }),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(409);
  });
});

// ── report テスト ─────────────────────────────────────────────────────────────

describe("report API — 統合テスト", () => {
  let POST: ReportPostHandler;

  function buildReportAdminClient(item: {
    id: string;
    seller_id: string;
    status: string;
  } | null) {
    const tables: Record<string, Array<{ data: unknown }>> = {
      knowledge_items: [{ data: item }],
    };
    if (item !== null && item.status === "published" && item.seller_id !== USER_ID) {
      tables["knowledge_item_reports"] = [{ data: null, error: null }];
    }
    const base = createTableQueuedMockAdminClient(tables);
    return {
      from: base.from,
      rpc: (_name: string, _args: unknown) => Promise.resolve({ error: null }),
    };
  }

  beforeAll(() => {
    setupKnowledgeMocks();

    mockHelpers.injectModule(mockHelpers.resolveAlias("next/server"), {
      after: (fn: () => unknown) => { fn(); },
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = (require("@/app/api/v1/knowledge/[id]/report/route") as ReportModule).POST;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read", "write"] };
  });

  it("invalid UUID → 400", async () => {
    const res = await POST(
      jsonRequest("http://localhost/api/v1/knowledge/not-a-uuid/report", "POST", { reason: "spam" }),
      makeCtx("not-a-uuid")
    );
    expect(res.status).toBe(400);
  });

  it("invalid reason → 400", async () => {
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/report`, "POST", { reason: "invalid_reason" }),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(400);
  });

  it("item not found → 404", async () => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildReportAdminClient(null),
    });
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/report`, "POST", { reason: "spam" }),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(404);
  });

  it("item status=draft → 404 (published 以外は拒否)", async () => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildReportAdminClient({
        id: ITEM_ID, seller_id: SELLER_ID, status: "draft",
      }),
    });
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/report`, "POST", { reason: "spam" }),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(404);
  });

  it("自己報告 (seller_id === user.id) → 400", async () => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildReportAdminClient({
        id: ITEM_ID, seller_id: USER_ID, status: "published",
      }),
    });
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/report`, "POST", { reason: "spam" }),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("他ユーザーの published item → 201 + reported:true", async () => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildReportAdminClient({
        id: ITEM_ID, seller_id: SELLER_ID, status: "published",
      }),
    });
    const res = await POST(
      jsonRequest(`http://localhost/api/v1/knowledge/${ITEM_ID}/report`, "POST", { reason: "spam" }),
      makeCtx(ITEM_ID)
    );
    expect(res.status).toBe(201);
    const json = await res.json() as { success: boolean; data: { reported: boolean } };
    expect(json.data.reported).toBe(true);
  });
});
