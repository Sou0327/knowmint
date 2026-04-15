/**
 * T-8: me/purchases + me/listings 統合テスト
 *
 * 認可フィルタ (.eq("buyer_id") / .eq("seller_id")) が実際に
 * DB クエリに含まれることを expectedCalls で検証する。
 *
 * 外部依存はすべてモック化しているため CI で実行可能 (Supabase CLI 不要)。
 */
import { expect, describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupKnowledgeMocks,
  teardownKnowledgeMocks,
  mockAuth,
  createTableQueuedMockAdminClient,
  resetMockAuth,
} from "./helpers/supabase-mock";

// ── route モジュール型 ────────────────────────────────────────────────────────

type GetHandler = (req: Request) => Promise<Response>;
type PurchasesModule = { GET: GetHandler };
type ListingsModule  = { GET: GetHandler };

// ── 定数 ──────────────────────────────────────────────────────────────────────

const USER_ID = "test-user-id";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockHelpers = require("./helpers/supabase-mock") as {
  resolveAlias: (p: string) => string;
  injectModule: (p: string, e: Record<string, unknown>) => void;
};

function getRequest(url: string): Request {
  return new Request(url, { headers: { Authorization: "Bearer km_test" } });
}

// ── me/purchases テスト ───────────────────────────────────────────────────────

describe("GET /me/purchases — 統合テスト", () => {
  let GET: GetHandler;

  function buildPurchasesAdminClient(data: unknown[] = []) {
    return createTableQueuedMockAdminClient({
      transactions: [
        {
          data,
          // T-8 核心: buyer_id フィルタが欠落しても検出できる
          expectedCalls: [{ method: "eq", args: ["buyer_id", USER_ID] }],
        },
      ],
    });
  }

  beforeAll(() => {
    setupKnowledgeMocks();
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildPurchasesAdminClient(),
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GET = (require("@/app/api/v1/me/purchases/route") as PurchasesModule).GET;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read"] };
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildPurchasesAdminClient(),
    });
  });

  it("認証なし → 401", async () => {
    mockAuth.user = null;
    const res = await GET(getRequest("http://localhost/api/v1/me/purchases"));
    expect(res.status).toBe(401);
  });

  it("read パーミッションなし → 403", async () => {
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: [] };
    const res = await GET(getRequest("http://localhost/api/v1/me/purchases"));
    expect(res.status).toBe(403);
  });

  it("認証あり → 200 + pagination レスポンス (.eq('buyer_id', userId) 呼び出し検証)", async () => {
    // expectedCalls で buyer_id フィルタが実際に適用されていることを保証
    const res = await GET(getRequest("http://localhost/api/v1/me/purchases"));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: unknown[];
      pagination: { total: number; page: number; per_page: number };
    };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(typeof json.pagination).toBe("object");
  });

  it("page パラメータ → 200", async () => {
    const res = await GET(getRequest("http://localhost/api/v1/me/purchases?page=2&per_page=5"));
    expect(res.status).toBe(200);
  });
});

// ── me/listings テスト ────────────────────────────────────────────────────────

describe("GET /me/listings — 統合テスト", () => {
  let GET: GetHandler;

  function buildListingsAdminClient(data: unknown[] = []) {
    return createTableQueuedMockAdminClient({
      knowledge_items: [
        {
          data,
          // T-8 核心: seller_id フィルタが欠落しても検出できる
          expectedCalls: [{ method: "eq", args: ["seller_id", USER_ID] }],
        },
      ],
    });
  }

  beforeAll(() => {
    setupKnowledgeMocks();
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildListingsAdminClient(),
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GET = (require("@/app/api/v1/me/listings/route") as ListingsModule).GET;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read"] };
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildListingsAdminClient(),
    });
  });

  it("認証なし → 401", async () => {
    mockAuth.user = null;
    const res = await GET(getRequest("http://localhost/api/v1/me/listings"));
    expect(res.status).toBe(401);
  });

  it("read パーミッションなし → 403", async () => {
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: [] };
    const res = await GET(getRequest("http://localhost/api/v1/me/listings"));
    expect(res.status).toBe(403);
  });

  it("認証あり → 200 + pagination レスポンス (.eq('seller_id', userId) 呼び出し検証)", async () => {
    // expectedCalls で seller_id フィルタが実際に適用されていることを保証
    const res = await GET(getRequest("http://localhost/api/v1/me/listings"));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: unknown[];
      pagination: { total: number; page: number; per_page: number };
    };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(typeof json.pagination).toBe("object");
  });

  it("per_page パラメータ → 200", async () => {
    const res = await GET(getRequest("http://localhost/api/v1/me/listings?per_page=10"));
    expect(res.status).toBe(200);
  });
});
