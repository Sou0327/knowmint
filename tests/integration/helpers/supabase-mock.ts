/**
 * 統合テスト用モックヘルパー
 *
 * require.cache への事前注入でモジュールをモック化する。
 * テストファイルの before() の中で:
 *   1. setupXxxMocks() を呼ぶ
 *   2. その後 require() でルートモジュールをロードする
 */

// ── モック状態（テストから書き換え可） ────────────────────────────────────

/** DB insert/select の返却値。テスト毎に上書きする。 */
export const mockDb = {
  singleData: null as unknown,
  singleError: null as unknown,
  directData: [] as unknown,
  directError: null as unknown,
};

/** 認証ユーザー。null を設定すると 401 を返す。 */
export const mockAuth = {
  user: {
    userId: "test-user-id",
    keyId: "test-key-id",
    permissions: ["read", "write", "admin"],
  } as { userId: string; keyId: string; permissions: string[] } | null,
};

/** mockAuth を既定値にリセットする。各 setup*Mocks() が冒頭で呼ぶ。 */
export function resetMockAuth(): void {
  mockAuth.user = {
    userId: "test-user-id",
    keyId: "test-key-id",
    permissions: ["read", "write", "admin"],
  };
}

export function resetMockDb(opts?: {
  singleData?: unknown;
  singleError?: unknown;
}) {
  mockDb.singleData =
    opts?.singleData !== undefined
      ? opts.singleData
      : {
          id: "mock-id",
          name: "test",
          permissions: ["read"],
          created_at: "2026-02-22T00:00:00Z",
          expires_at: null,
        };
  mockDb.singleError = opts?.singleError ?? null;
  mockDb.directData = [];
  mockDb.directError = null;
}

// ── モック Supabase admin クライアント ────────────────────────────────────

function createChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};

  const noopMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "gte",
    "lte",
    "order",
    "limit",
    "range",
    "textSearch",
    "contains",
  ];

  for (const m of noopMethods) {
    chain[m] = () => chain;
  }

  // .single() — 1件必須。0件の場合は error を返す
  chain["single"] = () =>
    Promise.resolve({ data: mockDb.singleData, error: mockDb.singleError });

  // .maybeSingle() — 0〜1件。0件の場合は data=null, error=null
  chain["maybeSingle"] = () =>
    Promise.resolve({ data: mockDb.singleData, error: mockDb.singleError });

  // チェーンを直接 await したとき（count: "estimated" 付き select 等）
  chain["then"] = (
    resolve: (v: unknown) => void,
    reject?: (e: unknown) => void
  ) =>
    Promise.resolve({
      data: mockDb.directData,
      error: mockDb.directError,
      count: 0,
    }).then(resolve, reject);

  return chain;
}

export function createMockAdminClient() {
  return { from: () => createChain() };
}

// ── require.cache 注入ユーティリティ ─────────────────────────────────────

function injectModule(
  resolvedPath: string,
  exports: Record<string, unknown>
): void {
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports,
    parent: null,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;
}

function resolveAlias(aliasPath: string): string {
  // tsconfig-paths が登録済みなので require.resolve('@/...') が使える
  return require.resolve(aliasPath);
}

function clearModule(aliasPath: string): void {
  try {
    delete require.cache[resolveAlias(aliasPath)];
  } catch {
    // 解決できないパスは無視
  }
}

// ── API_ERRORS 定数（モック response で使用） ─────────────────────────────

const API_ERRORS_MOCK = {
  UNAUTHORIZED: { code: "unauthorized", status: 401 },
  FORBIDDEN: { code: "forbidden", status: 403 },
  NOT_FOUND: { code: "not_found", status: 404 },
  RATE_LIMITED: { code: "rate_limited", status: 429 },
  BAD_REQUEST: { code: "bad_request", status: 400 },
  CONFLICT: { code: "conflict", status: 409 },
  INTERNAL_ERROR: { code: "internal_error", status: 500 },
} as const;

// ── モック response（NextResponse を使わず native Response で代替） ────────

function mockApiSuccess(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockApiError(
  error: { code: string; status: number },
  details?: string
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code: error.code, message: details ?? error.code },
    }),
    { status: error.status, headers: { "Content-Type": "application/json" } }
  );
}

function mockApiPaginated(
  data: unknown[],
  total: number,
  page: number,
  perPage: number
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      pagination: { total, page, per_page: perPage },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

const responseMockExports = {
  apiSuccess: mockApiSuccess,
  apiError: mockApiError,
  apiPaginated: mockApiPaginated,
  withRateLimitHeaders: (res: Response) => res,
  API_ERRORS: API_ERRORS_MOCK,
};

// ── モック rate-limit ──────────────────────────────────────────────────────

const rateLimitMockExports = {
  checkPreAuthRateLimit: async () => ({
    allowed: true,
    remaining: 100,
    resetMs: 0,
  }),
  checkRateLimit: async () => ({ allowed: true, remaining: 100, resetMs: 0 }),
};

// ── keys ルート用セットアップ ─────────────────────────────────────────────

export function setupKeysMocks(): void {
  resetMockAuth();
  resetMockDb();

  injectModule(resolveAlias("@/lib/api/response"), responseMockExports);
  injectModule(resolveAlias("@/lib/api/rate-limit"), rateLimitMockExports);

  injectModule(resolveAlias("@/lib/api/auth"), {
    authenticateApiKey: async () => mockAuth.user,
    generateApiKey: async () => ({
      raw: "km_" + "a".repeat(64),
      hash: "b".repeat(64),
    }),
  });

  injectModule(resolveAlias("@/lib/supabase/admin"), {
    getAdminClient: () => createMockAdminClient(),
  });

  injectModule(resolveAlias("@/lib/supabase/server"), {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: null } }) },
    }),
  });

  injectModule(resolveAlias("@/lib/audit/log"), {
    logAuditEvent: () => {},
  });
}

export function teardownKeysMocks(): void {
  const paths = [
    "@/lib/api/response",
    "@/lib/api/rate-limit",
    "@/lib/api/auth",
    "@/lib/supabase/admin",
    "@/lib/supabase/server",
    "@/lib/audit/log",
    "@/app/api/v1/keys/route",
  ];
  for (const p of paths) clearModule(p);
}

// ── withApiAuth ベースのルート用セットアップ ─────────────────────────────

type ApiHandler = (
  req: Request,
  user: { userId: string; keyId: string; permissions: string[] },
  rateLimit: { remaining: number; resetMs: number },
  context?: unknown
) => Promise<Response>;

function buildWithApiAuthMock() {
  return {
    withApiAuth: (
      handler: ApiHandler,
      options?: { requiredPermissions?: string[] }
    ) =>
      async (request: Request, context?: unknown) => {
        const user = mockAuth.user;
        if (!user) return mockApiError(API_ERRORS_MOCK.UNAUTHORIZED);
        // 本番 withApiAuth と同等の権限チェック
        if (options?.requiredPermissions) {
          const hasAll = options.requiredPermissions.every((p) =>
            user.permissions.includes(p)
          );
          if (!hasAll) return mockApiError(API_ERRORS_MOCK.FORBIDDEN);
        }
        // 本番 withApiAuth と同等の例外ハンドリング
        try {
          return await handler(
            request,
            user,
            { remaining: 100, resetMs: 0 },
            context
          );
        } catch {
          return mockApiError(API_ERRORS_MOCK.INTERNAL_ERROR);
        }
      },
  };
}

export function setupKnowledgeMocks(): void {
  resetMockAuth();
  resetMockDb({
    singleData: {
      id: "mock-knowledge-id",
      seller_id: "test-user-id",
      listing_type: "offer",
      title: "Test",
      description: "Desc",
      content_type: "prompt",
      price_sol: null,
      price_usdc: null,
      preview_content: null,
      category_id: null,
      tags: [],
      status: "draft",
      view_count: 0,
      purchase_count: 0,
      average_rating: null,
      metadata: {},
      usefulness_score: null,
      created_at: "2026-02-22T00:00:00Z",
      updated_at: "2026-02-22T00:00:00Z",
    },
  });

  injectModule(resolveAlias("@/lib/api/response"), responseMockExports);
  injectModule(resolveAlias("@/lib/api/middleware"), buildWithApiAuthMock());
  injectModule(resolveAlias("@/lib/supabase/admin"), {
    getAdminClient: () => createMockAdminClient(),
  });
  injectModule(resolveAlias("@/lib/audit/log"), { logAuditEvent: () => {} });
}

export function teardownKnowledgeMocks(): void {
  const paths = [
    "@/lib/api/response",
    "@/lib/api/middleware",
    "@/lib/supabase/admin",
    "@/lib/audit/log",
    "@/app/api/v1/knowledge/route",
  ];
  for (const p of paths) clearModule(p);
}

export function setupWebhooksMocks(): void {
  resetMockAuth();
  resetMockDb({
    singleData: {
      id: "mock-webhook-id",
      url: "https://example.com/hook",
      events: ["purchase.completed"],
      active: true,
      created_at: "2026-02-22T00:00:00Z",
    },
  });

  injectModule(resolveAlias("@/lib/api/response"), responseMockExports);
  injectModule(resolveAlias("@/lib/api/middleware"), buildWithApiAuthMock());
  injectModule(resolveAlias("@/lib/supabase/admin"), {
    getAdminClient: () => createMockAdminClient(),
  });
  injectModule(resolveAlias("@/lib/audit/log"), { logAuditEvent: () => {} });
  // encryptSecret は例外を握りつぶすので実モジュールのままでOK（未設定は警告のみ）
}

export function teardownWebhooksMocks(): void {
  const paths = [
    "@/lib/api/response",
    "@/lib/api/middleware",
    "@/lib/supabase/admin",
    "@/lib/audit/log",
    "@/app/api/v1/webhooks/route",
  ];
  for (const p of paths) clearModule(p);
}
