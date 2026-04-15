/**
 * T-5: admin/reports 統合テスト
 *
 * GET  /api/v1/admin/reports      — パーミッション確認・一覧取得・invalid status
 * POST /api/v1/admin/reports/[id] — 存在確認・RPC 呼び出し・admin 限定
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

type GetHandler = (req: Request) => Promise<Response>;
type PostHandler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

type ReportsRouteModule = { GET: GetHandler };
type ReportIdRouteModule = { POST: PostHandler };

const REPORT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const ITEM_ID   = "11111111-2222-3333-4444-555555555555";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeGetRequest(searchParams = ""): Request {
  return new Request(
    `http://localhost/api/v1/admin/reports${searchParams ? "?" + searchParams : ""}`,
    { headers: { Authorization: "Bearer km_adminkey" } }
  );
}

function makePostRequest(id: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/v1/admin/reports/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer km_adminkey",
    },
    body: JSON.stringify(body),
  });
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── admin/reports GET テスト ──────────────────────────────────────────────────

describe("GET /admin/reports — 統合テスト", () => {
  let GET: GetHandler;

  beforeAll(() => {
    setupKnowledgeMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GET = (require("@/app/api/v1/admin/reports/route") as ReportsRouteModule).GET;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { clearModule } = require("./helpers/supabase-mock");
    try { clearModule?.("@/app/api/v1/admin/reports/route"); } catch { /* noop */ }
  });

  beforeEach(() => {
    resetMockAuth();
    // admin パーミッション付きユーザーをデフォルトに設定
    mockAuth.user = { userId: "admin-user-id", keyId: "test-key-id", permissions: ["read", "write", "admin"] };
  });

  it("admin パーミッションなし → 403", async () => {
    mockAuth.user = { userId: "test-user-id", keyId: "test-key-id", permissions: ["read", "write"] };
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("invalid status パラメータ → 400", async () => {
    mockDb.directData = [];
    mockDb.directError = null;
    const res = await GET(makeGetRequest("status=invalid_status"));
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
  });

  it("valid status=pending → 200 + pagination レスポンス", async () => {
    mockDb.directData = [
      { id: REPORT_ID, knowledge_item_id: ITEM_ID, reason: "spam", status: "pending" },
    ];
    mockDb.directError = null;
    const res = await GET(makeGetRequest("status=pending"));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: unknown[]; pagination: unknown };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("status=reviewing → 200", async () => {
    mockDb.directData = [];
    mockDb.directError = null;
    const res = await GET(makeGetRequest("status=reviewing"));
    expect(res.status).toBe(200);
  });

  it("status=resolved → 200", async () => {
    mockDb.directData = [];
    mockDb.directError = null;
    const res = await GET(makeGetRequest("status=resolved"));
    expect(res.status).toBe(200);
  });

  it("status=dismissed → 200", async () => {
    mockDb.directData = [];
    mockDb.directError = null;
    const res = await GET(makeGetRequest("status=dismissed"));
    expect(res.status).toBe(200);
  });

  it("認証なし (mockAuth.user=null) → 401", async () => {
    mockAuth.user = null;
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });
});

// ── admin/reports/[id] POST テスト ────────────────────────────────────────────

describe("POST /admin/reports/[id] — 統合テスト", () => {
  let POST: PostHandler;

  // rpc() に対応した admin クライアントを注入するため独自 setup
  const { resolveAlias, injectModule } = (() => {
    // supabase-mock の内部ユーティリティに型なしアクセス
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("./helpers/supabase-mock") as Record<string, unknown>;
    return {
      resolveAlias: m["resolveAlias"] as ((p: string) => string) | undefined,
      injectModule: m["injectModule"] as ((p: string, e: Record<string, unknown>) => void) | undefined,
    };
  })();

  const mockRpcResult = { error: null as null | { message: string } };

  function buildAdminClient() {
    const reportItem = { id: REPORT_ID, knowledge_item_id: ITEM_ID, status: "pending" };
    const queued = createTableQueuedMockAdminClient({
      knowledge_item_reports: [{ data: reportItem }],
    });
    return {
      from: queued.from,
      rpc: (_name: string, _args: unknown) => Promise.resolve({ error: mockRpcResult.error }),
    };
  }

  beforeAll(() => {
    setupKnowledgeMocks();

    // rpc 対応 admin クライアントを再注入
    if (injectModule && resolveAlias) {
      injectModule(resolveAlias("@/lib/supabase/admin"), {
        getAdminClient: () => buildAdminClient(),
      });
      // next/server after() スタブ
      injectModule(resolveAlias("next/server"), {
        after: (fn: () => unknown) => { fn(); },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = (require("@/app/api/v1/admin/reports/[id]/route") as ReportIdRouteModule).POST;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: "admin-user-id", keyId: "test-key-id", permissions: ["read", "write", "admin"] };
    mockRpcResult.error = null;
  });

  it("admin パーミッションなし → 403", async () => {
    mockAuth.user = { userId: "test-user-id", keyId: "test-key-id", permissions: ["read", "write"] };
    const res = await POST(makePostRequest(REPORT_ID, { action: "resolve" }), makeCtx(REPORT_ID));
    expect(res.status).toBe(403);
  });

  it("invalid UUID → 400", async () => {
    const res = await POST(makePostRequest("not-a-uuid", { action: "resolve" }), makeCtx("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("invalid action → 400", async () => {
    const res = await POST(makePostRequest(REPORT_ID, { action: "invalid_action" }), makeCtx(REPORT_ID));
    expect(res.status).toBe(400);
  });

  it("valid resolve → 200 + { reviewed:true, status:'resolved' }", async () => {
    const res = await POST(makePostRequest(REPORT_ID, { action: "resolve" }), makeCtx(REPORT_ID));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { reviewed: boolean; status: string } };
    expect(json.success).toBe(true);
    expect(json.data.reviewed).toBe(true);
    expect(json.data.status).toBe("resolved");
  });

  it("valid dismiss → 200 + { status:'dismissed' }", async () => {
    const res = await POST(makePostRequest(REPORT_ID, { action: "dismiss" }), makeCtx(REPORT_ID));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { status: string } };
    expect(json.data.status).toBe("dismissed");
  });

  it("valid start_review → 200 + { status:'reviewing' }", async () => {
    const res = await POST(makePostRequest(REPORT_ID, { action: "start_review" }), makeCtx(REPORT_ID));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { status: string } };
    expect(json.data.status).toBe("reviewing");
  });
});
