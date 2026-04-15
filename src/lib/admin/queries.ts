import { getAdminClient } from "@/lib/supabase/admin";
import type { ReportStatus, KnowledgeStatus, ContentType, TransactionStatus, Chain, Token } from "@/types/database.types";
import type { PaginatedResult } from "@/types/knowledge.types";

/** Build a PaginatedResult from raw Supabase row data + count. */
function toPaginated<T>(
  data: T[],
  total: number,
  page: number,
  perPage: number,
): PaginatedResult<T> {
  return {
    data,
    total,
    page,
    per_page: perPage,
    total_pages: perPage > 0 ? Math.ceil(total / perPage) : 0,
  };
}

/**
 * Sanitize user input for safe use in PostgREST .or() ilike patterns.
 *
 * RP1 (L-4):
 * - Unicode プロパティエスケープ `\p{L}` (Letter) + `\p{N}` (Number) で
 *   全スクリプトの文字・数字を許可。従来の CJK Unified 範囲 (U+3000-U+9FFF /
 *   U+AC00-U+D7AF) では欠落していた Cyrillic / Greek / Arabic / 絵文字外の
 *   拡張 Hangul などを包括的にサポートしつつ、サロゲート・制御文字・絵文字
 *   (`\p{So}`) は除去される。
 * - `.trim()` で前後空白を落とす。空白のみ入力は空文字になる (呼び出し側で
 *   `safe.length >= 2` によりスキップされる)。
 * - 残った安全文字に対して LIKE ワイルドカード `%_\\` をエスケープして
 *   DSL injection を根絶する。
 */
function sanitizeSearchInput(input: string): string {
  // Allow only letters, numbers, whitespace, underscore, hyphen across all scripts
  const stripped = input.replace(/[^\p{L}\p{N}\s_-]/gu, "").trim();
  // Escape LIKE wildcards in the remaining safe string
  return stripped.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

export { sanitizeSearchInput };

// --- Dashboard Stats ---

export interface AdminDashboardStats {
  totalUsers: number;
  totalListings: number;
  totalTransactions: number;
  totalRevenue: Record<string, number>;
  pendingReports: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const admin = getAdminClient();

  const [usersResult, listingsResult, txCountResult, revenueResult, reportsResult] =
    await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin
        .from("knowledge_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      admin
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),
      admin.rpc("get_revenue_by_token"),
      admin
        .from("knowledge_item_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  // Fallback: if RPC not yet deployed, aggregate in JS
  const totalRevenue: Record<string, number> = { SOL: 0, USDC: 0, ETH: 0 };
  if (!revenueResult.error && Array.isArray(revenueResult.data) && revenueResult.data.length > 0) {
    for (const row of revenueResult.data) {
      totalRevenue[row.token] = Number(row.total);
    }
  } else {
    // Fallback: load and aggregate in JS (pre-RPC migration)
    const { data: txRows } = await admin
      .from("transactions")
      .select("amount, token")
      .eq("status", "confirmed");
    txRows?.forEach((tx) => {
      totalRevenue[tx.token] = (totalRevenue[tx.token] ?? 0) + Number(tx.amount);
    });
  }

  return {
    totalUsers: usersResult.count ?? 0,
    totalListings: listingsResult.count ?? 0,
    totalTransactions: txCountResult.count ?? 0,
    totalRevenue,
    pendingReports: reportsResult.count ?? 0,
  };
}

// --- Users ---

export interface AdminUserRow {
  id: string;
  display_name: string | null;
  user_type: string;
  avatar_url: string | null;
  wallet_address: string | null;
  is_admin: boolean;
  banned_at: string | null;
  trust_score: number | null;
  created_at: string;
}

export async function getAdminUsers(params: {
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResult<AdminUserRow>> {
  const admin = getAdminClient();
  const page = params.page ?? 1;
  const per_page = params.per_page ?? 20;
  const from = (page - 1) * per_page;

  let query = admin
    .from("profiles")
    .select(
      "id, display_name, user_type, avatar_url, wallet_address, is_admin, banned_at, trust_score, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + per_page - 1);

  if (params.search) {
    const safe = sanitizeSearchInput(params.search);
    // RP1 (L-4): 1 文字以下の検索はノイズが多いためスキップ (空クエリ扱い)
    if (safe.length >= 2) {
      query = query.or(
        `display_name.ilike.%${safe}%,wallet_address.ilike.%${safe}%`
      );
    }
  }

  const { data, count, error } = await query;
  // L-16: エラーを握りつぶさず throw で上位に伝播
  if (error) {
    console.error("[admin/users] fetch failed:", error);
    throw new Error(`[admin/users] ${error.message}`);
  }
  return toPaginated<AdminUserRow>(
    (data ?? []) as AdminUserRow[],
    count ?? 0,
    page,
    per_page,
  );
}

// --- Reports ---

export interface AdminReportRow {
  id: string;
  knowledge_item_id: string;
  reporter_id: string;
  reason: string;
  description: string | null;
  status: string;
  reviewer_id: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  knowledge_item: {
    id: string;
    title: string;
    seller_id: string;
    status: string;
  } | null;
}

export async function getAdminReports(params: {
  status?: ReportStatus;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResult<AdminReportRow>> {
  const admin = getAdminClient();
  const page = params.page ?? 1;
  const per_page = params.per_page ?? 20;
  const from = (page - 1) * per_page;

  let query = admin
    .from("knowledge_item_reports")
    .select(
      `id, knowledge_item_id, reporter_id, reason, description,
       status, reviewer_id, reviewer_note, reviewed_at, created_at,
       knowledge_item:knowledge_items(id, title, seller_id, status)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + per_page - 1);

  if (params.status) {
    query = query.eq("status", params.status as ReportStatus);
  }

  const { data, count, error } = await query;
  // L-16: エラーを握りつぶさず throw で上位に伝播
  if (error) {
    console.error("[admin/reports] fetch failed:", error);
    throw new Error(`[admin/reports] ${error.message}`);
  }

  // Normalize Supabase array join to single object
  const normalized = (data ?? []).map((row) => ({
    ...row,
    knowledge_item: Array.isArray(row.knowledge_item)
      ? row.knowledge_item[0] ?? null
      : row.knowledge_item,
  }));

  return toPaginated<AdminReportRow>(
    normalized as AdminReportRow[],
    count ?? 0,
    page,
    per_page,
  );
}

// --- Listings ---

export interface AdminListingRow {
  id: string;
  title: string;
  content_type: string;
  status: string;
  moderation_status: string;
  price_sol: number | null;
  price_usdc: number | null;
  view_count: number;
  purchase_count: number;
  created_at: string;
  seller: { id: string; display_name: string | null } | null;
}

export async function getAdminListings(params: {
  search?: string;
  status?: string;
  content_type?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResult<AdminListingRow>> {
  const admin = getAdminClient();
  const page = params.page ?? 1;
  const per_page = params.per_page ?? 20;
  const from = (page - 1) * per_page;

  let query = admin
    .from("knowledge_items")
    .select(
      `id, title, content_type, status, moderation_status, price_sol, price_usdc,
       view_count, purchase_count, created_at,
       seller:profiles!seller_id(id, display_name)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + per_page - 1);

  if (params.search) {
    const safe = sanitizeSearchInput(params.search);
    // RP1 (L-4): 1 文字以下の検索はノイズが多いためスキップ (空クエリ扱い)
    if (safe.length >= 2) {
      query = query.ilike("title", `%${safe}%`);
    }
  }
  if (params.status) {
    query = query.eq("status", params.status as KnowledgeStatus);
  }
  if (params.content_type) {
    query = query.eq("content_type", params.content_type as ContentType);
  }

  const { data, count, error } = await query;
  // L-16: エラーを握りつぶさず throw で上位に伝播
  if (error) {
    console.error("[admin/listings] fetch failed:", error);
    throw new Error(`[admin/listings] ${error.message}`);
  }

  const normalized = (data ?? []).map((row) => ({
    ...row,
    seller: Array.isArray(row.seller) ? row.seller[0] ?? null : row.seller,
  }));

  return toPaginated<AdminListingRow>(
    normalized as AdminListingRow[],
    count ?? 0,
    page,
    per_page,
  );
}

// --- Transactions ---

export interface AdminTransactionRow {
  id: string;
  amount: number;
  token: string;
  chain: string;
  tx_hash: string;
  status: string;
  created_at: string;
  buyer: { id: string; display_name: string | null } | null;
  seller: { id: string; display_name: string | null } | null;
  knowledge_item: { id: string; title: string } | null;
}

export async function getAdminTransactions(params: {
  status?: string;
  chain?: string;
  token?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResult<AdminTransactionRow>> {
  const admin = getAdminClient();
  const page = params.page ?? 1;
  const per_page = params.per_page ?? 20;
  const from = (page - 1) * per_page;

  let query = admin
    .from("transactions")
    .select(
      `id, amount, token, chain, tx_hash, status, created_at,
       buyer:profiles!buyer_id(id, display_name),
       seller:profiles!seller_id(id, display_name),
       knowledge_item:knowledge_items(id, title)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + per_page - 1);

  if (params.status) {
    query = query.eq("status", params.status as TransactionStatus);
  }
  if (params.chain) {
    query = query.eq("chain", params.chain as Chain);
  }
  if (params.token) {
    query = query.eq("token", params.token as Token);
  }

  const { data, count, error } = await query;
  // L-16: エラーを握りつぶさず throw で上位に伝播
  if (error) {
    console.error("[admin/transactions] fetch failed:", error);
    throw new Error(`[admin/transactions] ${error.message}`);
  }

  const normalized = (data ?? []).map((row) => ({
    ...row,
    buyer: Array.isArray(row.buyer) ? row.buyer[0] ?? null : row.buyer,
    seller: Array.isArray(row.seller) ? row.seller[0] ?? null : row.seller,
    knowledge_item: Array.isArray(row.knowledge_item)
      ? row.knowledge_item[0] ?? null
      : row.knowledge_item,
  }));

  return toPaginated<AdminTransactionRow>(
    normalized as AdminTransactionRow[],
    count ?? 0,
    page,
    per_page,
  );
}

// --- API Keys ---

export interface AdminApiKeyRow {
  id: string;
  name: string;
  permissions: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  user: { id: string; display_name: string | null } | null;
}

export async function getAdminApiKeys(params: {
  page?: number;
  per_page?: number;
}) {
  const admin = getAdminClient();
  const page = params.page ?? 1;
  const per_page = params.per_page ?? 20;
  const from = (page - 1) * per_page;

  const { data, count, error } = await admin
    .from("api_keys")
    .select(
      `id, name, permissions, last_used_at, created_at, expires_at,
       user:profiles!user_id(id, display_name)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + per_page - 1);

  // L-16: エラーを握りつぶさず throw で上位に伝播
  if (error) {
    console.error("[admin/api-keys] fetch failed:", error);
    throw new Error(`[admin/api-keys] ${error.message}`);
  }

  const normalized = (data ?? []).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? row.user[0] ?? null : row.user,
  }));

  return {
    data: normalized as AdminApiKeyRow[],
    total: count ?? 0,
    page,
    per_page,
  };
}
