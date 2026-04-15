/**
 * T-10: transactions/[id] + cron/cleanup-pending-tx 統合テスト
 *
 * - GET /api/v1/transactions/[id]: 他ユーザーの TX へのアクセス → 404 (owner check)
 * - GET /api/cron/cleanup-pending-tx: CRON_SECRET なし → 401 (smoke test)
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

type TxGetHandler   = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
type CronGetHandler = (req: Request) => Promise<Response>;

type TxRouteModule   = { GET: TxGetHandler };
type CronRouteModule = { GET: CronGetHandler };

// ── 定数 ──────────────────────────────────────────────────────────────────────

const USER_ID   = "test-user-id";
const OTHER_ID  = "other-user-id";
const TX_ID     = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SELLER_ID = "seller-user-id";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockHelpers = require("./helpers/supabase-mock") as {
  resolveAlias: (p: string) => string;
  injectModule: (p: string, e: Record<string, unknown>) => void;
};

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    headers: { Authorization: "Bearer km_test", ...headers },
  });
}

// ── transactions/[id] GET テスト ──────────────────────────────────────────────

describe("GET /api/v1/transactions/[id] — 統合テスト", () => {
  let GET: TxGetHandler;

  function buildTxAdminClient(tx: {
    id: string;
    buyer_id: string;
    seller_id: string;
  } | null) {
    return createTableQueuedMockAdminClient({
      transactions: [{ data: tx }],
    });
  }

  beforeAll(() => {
    setupKnowledgeMocks();
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildTxAdminClient(null),
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GET = (require("@/app/api/v1/transactions/[id]/route") as TxRouteModule).GET;
  });

  afterAll(() => {
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    resetMockAuth();
    mockAuth.user = { userId: USER_ID, keyId: "test-key-id", permissions: ["read"] };
  });

  it("認証なし → 401", async () => {
    mockAuth.user = null;
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildTxAdminClient(null),
    });
    const res = await GET(getRequest(`http://localhost/api/v1/transactions/${TX_ID}`), makeCtx(TX_ID));
    expect(res.status).toBe(401);
  });

  it("TX not found → 404", async () => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildTxAdminClient(null),
    });
    const res = await GET(getRequest(`http://localhost/api/v1/transactions/${TX_ID}`), makeCtx(TX_ID));
    expect(res.status).toBe(404);
  });

  it("他ユーザーの TX (buyer_id ≠ user, seller_id ≠ user) → 404 (owner check)", async () => {
    // buyer_id も seller_id もリクエストユーザーと一致しない → アクセス拒否
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildTxAdminClient({
        id: TX_ID,
        buyer_id: OTHER_ID,
        seller_id: SELLER_ID,
      }),
    });
    const res = await GET(getRequest(`http://localhost/api/v1/transactions/${TX_ID}`), makeCtx(TX_ID));
    // ルートは NOT_FOUND を返す（情報漏洩防止のため 403 ではなく 404）
    expect(res.status).toBe(404);
  });

  it("buyer として自分の TX → 200", async () => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildTxAdminClient({
        id: TX_ID,
        buyer_id: USER_ID,
        seller_id: SELLER_ID,
      }),
    });
    const res = await GET(getRequest(`http://localhost/api/v1/transactions/${TX_ID}`), makeCtx(TX_ID));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { id: string } };
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(TX_ID);
  });

  it("seller として自分の TX → 200", async () => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildTxAdminClient({
        id: TX_ID,
        buyer_id: OTHER_ID,
        seller_id: USER_ID,
      }),
    });
    const res = await GET(getRequest(`http://localhost/api/v1/transactions/${TX_ID}`), makeCtx(TX_ID));
    expect(res.status).toBe(200);
  });
});

// ── cron/cleanup-pending-tx GET テスト (smoke) ───────────────────────────────

describe("GET /api/cron/cleanup-pending-tx — smoke テスト", () => {
  let GET: CronGetHandler;

  const originalEnv = process.env.CRON_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  function buildCleanupAdminClient() {
    return createTableQueuedMockAdminClient({
      transactions: [{ data: [], error: null }],
    });
  }

  beforeAll(() => {
    setupKnowledgeMocks();
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/api/response"), {
      apiSuccess: (data: unknown) =>
        new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      apiError: (error: { code: string; status: number }, details?: string) =>
        new Response(
          JSON.stringify({ success: false, error: { code: error.code, message: details ?? error.code } }),
          { status: error.status, headers: { "Content-Type": "application/json" } }
        ),
      API_ERRORS: {
        UNAUTHORIZED: { code: "unauthorized", status: 401 },
        INTERNAL_ERROR: { code: "internal_error", status: 500 },
      },
    });
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildCleanupAdminClient(),
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GET = (require("@/app/api/cron/cleanup-pending-tx/route") as CronRouteModule).GET;
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalEnv;
    process.env.NODE_ENV = originalNodeEnv;
    teardownKnowledgeMocks();
  });

  beforeEach(() => {
    mockHelpers.injectModule(mockHelpers.resolveAlias("@/lib/supabase/admin"), {
      getAdminClient: () => buildCleanupAdminClient(),
    });
  });

  it("CRON_SECRET 設定あり + ヘッダなし → 401", async () => {
    process.env.CRON_SECRET = "test-secret-value";
    const res = await GET(getRequest("http://localhost/api/cron/cleanup-pending-tx"));
    expect(res.status).toBe(401);
    delete process.env.CRON_SECRET;
  });

  it("CRON_SECRET 設定あり + 不正なヘッダ → 401", async () => {
    process.env.CRON_SECRET = "test-secret-value";
    const res = await GET(getRequest(
      "http://localhost/api/cron/cleanup-pending-tx",
      { Authorization: "Bearer wrong-secret" }
    ));
    expect(res.status).toBe(401);
    delete process.env.CRON_SECRET;
  });

  it("CRON_SECRET 設定あり + 正しいヘッダ → 200 + cleaned", async () => {
    process.env.CRON_SECRET = "test-secret-value";
    const res = await GET(getRequest(
      "http://localhost/api/cron/cleanup-pending-tx",
      { Authorization: "Bearer test-secret-value" }
    ));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { cleaned: number } };
    expect(json.success).toBe(true);
    expect(typeof json.data.cleaned).toBe("number");
    delete process.env.CRON_SECRET;
  });

  it("CRON_SECRET 未設定 + NODE_ENV=development → 200 (開発環境は認証スキップ)", async () => {
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = "development";
    const res = await GET(getRequest("http://localhost/api/cron/cleanup-pending-tx"));
    // 開発環境では CRON_SECRET なしでも許可される
    expect(res.status).toBe(200);
  });
});
