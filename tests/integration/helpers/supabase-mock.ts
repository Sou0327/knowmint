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
    "in",
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
        } catch (err) {
          // モックインフラエラーは再 throw して原因を可視化する
          if (err instanceof MockInfrastructureError) throw err;
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

// ── モックインフラ専用エラークラス ────────────────────────────────────────

/**
 * モックインフラ起因のエラー。
 * `withApiAuth` の catch ブロックで握りつぶされず、テスト失敗として表面化する。
 */
class MockInfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockInfrastructureError";
  }
}

// ── per-table キューモック ─────────────────────────────────────────────────

/** 単一メソッド呼び出しの期待値 */
type ExpectedCall = {
  method: string;
  args: unknown[];
};

/**
 * キューエントリ。
 * `expectedCalls` を指定すると、クエリ解決時に指定メソッド+引数が
 * 実際に呼ばれたことを検証する（認可クリティカルなフィルタの欠落を検出）。
 */
type QueueEntry = {
  data: unknown;
  error?: { code?: string; message?: string } | null;
  /**
   * 省略可能: 呼ばれるべきメソッドと引数の期待値リスト。
   * 指定した呼び出しが実際のチェーンに含まれない場合、MockInfrastructureError を throw する。
   *
   * @example
   * // transactions に対して .eq("tx_hash", VALID_TX_HASH) が必ず呼ばれることを保証する
   * { data: existingTx, expectedCalls: [{ method: "eq", args: ["tx_hash", VALID_TX_HASH] }] }
   */
  expectedCalls?: ExpectedCall[];
};

function createQueuedChain(entry: QueueEntry): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const recordedCalls: ExpectedCall[] = [];

  /** expectedCalls との照合。不一致があれば MockInfrastructureError を throw */
  function validateCalls(): void {
    if (!entry.expectedCalls) return;
    for (const expected of entry.expectedCalls) {
      const found = recordedCalls.some(
        (rec) =>
          rec.method === expected.method &&
          JSON.stringify(rec.args) === JSON.stringify(expected.args)
      );
      if (!found) {
        const actual = recordedCalls
          .map((c) => `.${c.method}(${c.args.map((a) => JSON.stringify(a)).join(", ")})`)
          .join(", ");
        throw new MockInfrastructureError(
          `[MockAdminClient] Expected .${expected.method}(${expected.args
            .map((a) => JSON.stringify(a))
            .join(", ")}) was not called.\n` +
            `Actual calls: [${actual || "(none)"}]`
        );
      }
    }
  }

  const noopMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "gte",
    "lte",
    "in",
    "order",
    "limit",
    "range",
    "textSearch",
    "contains",
  ];

  for (const m of noopMethods) {
    chain[m] = (...args: unknown[]) => {
      recordedCalls.push({ method: m, args });
      return chain;
    };
  }

  chain["single"] = () => {
    try {
      validateCalls();
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve({ data: entry.data, error: entry.error ?? null });
  };

  chain["maybeSingle"] = () => {
    try {
      validateCalls();
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve({ data: entry.data, error: entry.error ?? null });
  };

  chain["then"] = (
    resolve: (v: unknown) => void,
    reject?: (e: unknown) => void
  ) => {
    try {
      validateCalls();
    } catch (err) {
      return Promise.reject(err).then(resolve, reject);
    }
    return Promise.resolve({
      data: entry.data,
      error: entry.error ?? null,
      count: 0,
    }).then(resolve, reject);
  };

  return chain;
}

/**
 * per-table キューで個別の応答を返すモック Admin クライアント。
 * `from("tableName")` 呼び出し時点でキューの先頭を pop する。
 * Promise.all で同テーブルを並列取得する場合も正しい順序で返る。
 *
 * `QueueEntry.expectedCalls` を設定することで、認可クリティカルな
 * フィルタ条件（eq("tx_hash", hash) 等）が実際に呼ばれたかを検証できる。
 *
 * キューが明示的に設定されたテーブルでエントリが枯渇・未登録の場合は
 * MockInfrastructureError を throw してテスト設定ミスを即座に検出する。
 */
export function createTableQueuedMockAdminClient(
  tableQueues: Record<string, QueueEntry[]>
): { from: (tableName: string) => Record<string, unknown> } {
  return {
    from: (tableName: string) => {
      const queue = tableQueues[tableName];
      if (queue !== undefined) {
        // キューが明示設定されているテーブル: 枯渇したら即失敗
        const entry = queue.shift();
        if (entry === undefined) {
          throw new MockInfrastructureError(
            `[MockAdminClient] Queue exhausted for table "${tableName}". ` +
              `Add more entries to setContentTableQueues().`
          );
        }
        return createQueuedChain(entry);
      }
      // 未登録テーブルへのアクセスも即失敗: 想定外 DB クエリを見逃さない
      throw new MockInfrastructureError(
        `[MockAdminClient] Unexpected access to unregistered table "${tableName}". ` +
          `Add it to setContentTableQueues() if this call is expected.`
      );
    },
  };
}

// ── content route モック状態 ───────────────────────────────────────────────

/** `verifySolanaPurchaseTransaction` の戻り値を制御する */
export const mockVerifyTx = {
  result: { valid: true } as { valid: boolean; error?: string },
};

/** `isValidSolanaTxHash` の戻り値を制御する */
export const mockSolana = {
  isValidHash: true,
};

let _contentTableQueues: Record<string, QueueEntry[]> = {};

/** テスト毎に DB キューを設定する */
export function setContentTableQueues(
  queues: Record<string, QueueEntry[]>
): void {
  _contentTableQueues = queues;
}

// ── content ルート用セットアップ ─────────────────────────────────────────

export function setupContentMocks(): void {
  resetMockAuth();

  injectModule(resolveAlias("@/lib/api/response"), responseMockExports);
  injectModule(resolveAlias("@/lib/api/middleware"), buildWithApiAuthMock());

  injectModule(resolveAlias("@/lib/supabase/admin"), {
    getAdminClient: () =>
      createTableQueuedMockAdminClient(_contentTableQueues),
  });

  injectModule(resolveAlias("@/lib/audit/log"), { logAuditEvent: () => {} });

  // NextResponse.json を native Response で代替（Next.js ランタイム不要）
  injectModule(resolveAlias("next/server"), {
    NextResponse: {
      json: (
        body: unknown,
        init?: { status?: number; headers?: Record<string, string> }
      ) =>
        new Response(JSON.stringify(body), {
          status: init?.status ?? 200,
          headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
        }),
    },
  });

  injectModule(resolveAlias("@/lib/solana/verify-transaction"), {
    verifySolanaPurchaseTransaction: async () => mockVerifyTx.result,
    isValidSolanaTxHash: () => mockSolana.isValidHash,
  });

  injectModule(resolveAlias("@/lib/storage/datasets"), {
    createDatasetSignedDownloadUrl: async () => null,
  });

  // @/lib/x402 は実モジュールをそのまま使用（ユーティリティのみ、副作用なし）
}

export function teardownContentMocks(): void {
  const paths = [
    "@/lib/api/response",
    "@/lib/api/middleware",
    "@/lib/supabase/admin",
    "@/lib/audit/log",
    "next/server",
    "@/lib/solana/verify-transaction",
    "@/lib/storage/datasets",
    "@/app/api/v1/knowledge/[id]/content/route",
  ];
  for (const p of paths) clearModule(p);
}

// ── purchase ルート用モック状態 ────────────────────────────────────────────

/** `rpc("confirm_transaction")` の返却エラーを制御する */
export const mockPurchaseRpc = {
  confirmTransaction: {
    error: null as null | { code?: string; message?: string },
  },
};

let _purchaseTableQueues: Record<string, QueueEntry[]> = {};

/** テスト毎に DB キューを設定する */
export function setPurchaseTableQueues(
  queues: Record<string, QueueEntry[]>
): void {
  _purchaseTableQueues = queues;
}

/** rpc() 対応の Admin クライアント（purchase ルート用） */
function createPurchaseMockAdminClient() {
  const base = createTableQueuedMockAdminClient(_purchaseTableQueues);
  return {
    from: base.from,
    rpc: (name: string, args?: Record<string, unknown>) => {
      if (name === "confirm_transaction") {
        // tx_id が文字列として渡されていることを検証（認可クリティカル）
        if (!args || typeof args["tx_id"] !== "string" || args["tx_id"] === "") {
          throw new MockInfrastructureError(
            `[MockAdminClient] rpc("confirm_transaction") called with invalid tx_id. ` +
              `Expected non-empty string, got: ${JSON.stringify(args?.["tx_id"])} ` +
              `(args: ${JSON.stringify(args)})`
          );
        }
        return Promise.resolve({
          error: mockPurchaseRpc.confirmTransaction.error,
        });
      }
      if (name === "increment_purchase_count") {
        // fire-and-forget: item_id が文字列として渡されていることを確認
        if (!args || typeof args["item_id"] !== "string" || args["item_id"] === "") {
          throw new MockInfrastructureError(
            `[MockAdminClient] rpc("increment_purchase_count") called with invalid item_id. ` +
              `Expected non-empty string, got: ${JSON.stringify(args?.["item_id"])}`
          );
        }
        return Promise.resolve({ error: null });
      }
      throw new MockInfrastructureError(
        `[MockAdminClient] Unexpected rpc call: "${name}". ` +
          `Add it to createPurchaseMockAdminClient() if this call is expected.`
      );
    },
  };
}

// ── purchase ルート用セットアップ ─────────────────────────────────────────

export function setupPurchaseMocks(): void {
  resetMockAuth();
  mockAuth.user = {
    userId: "buyer-user-id",
    keyId: "test-key-id",
    permissions: ["read", "write"],
  };

  injectModule(resolveAlias("@/lib/api/response"), responseMockExports);
  injectModule(resolveAlias("@/lib/api/middleware"), buildWithApiAuthMock());
  injectModule(resolveAlias("@/lib/supabase/admin"), {
    getAdminClient: () => createPurchaseMockAdminClient(),
  });
  injectModule(resolveAlias("@/lib/audit/log"), { logAuditEvent: () => {} });
  injectModule(resolveAlias("@/lib/solana/verify-transaction"), {
    verifySolanaPurchaseTransaction: async () => mockVerifyTx.result,
    isValidSolanaTxHash: () => mockSolana.isValidHash,
  });
  injectModule(resolveAlias("@/lib/notifications/create"), {
    notifyPurchase: async () => {},
  });
  injectModule(resolveAlias("@/lib/webhooks/events"), {
    fireWebhookEvent: async () => {},
  });
}

export function teardownPurchaseMocks(): void {
  const paths = [
    "@/lib/api/response",
    "@/lib/api/middleware",
    "@/lib/supabase/admin",
    "@/lib/audit/log",
    "@/lib/solana/verify-transaction",
    "@/lib/notifications/create",
    "@/lib/webhooks/events",
    "@/app/api/v1/knowledge/[id]/purchase/route",
  ];
  for (const p of paths) clearModule(p);
}
