/**
 * API validation helpers (shared across route handlers & server actions).
 *
 * Pure functions only — no I/O. These helpers are exercised by
 * `tests/unit/validation.test.ts`.
 */

// ── UUID ───────────────────────────────────────────────

/**
 * Canonical UUID v1-v5 matcher (RFC 4122 shape, case-insensitive).
 *
 * The 13th nibble (version) is not constrained because callers use this to
 * guard ID-shaped strings of any generator (DB uuid_generate_v4, clients, etc.)
 * and the DB layer performs the strict spec validation.
 */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Type guard for UUID-shaped strings. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ── Pagination ─────────────────────────────────────────

export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginationOptions {
  /** Upper bound for `page` (default 1000 — matches existing routes). */
  maxPage?: number;
  /** Upper bound for `per_page` (default 100). */
  maxPerPage?: number;
  /** Default when `per_page` is missing (default 20). */
  defaultPerPage?: number;
  /** Default when `page` is missing (default 1). */
  defaultPage?: number;
}

/**
 * Parse `page` / `per_page` from a URL `searchParams` with safe defaults
 * and bounds. Non-numeric / NaN / Infinity / negative values fall back to
 * the defaults. The return is always a positive integer pair.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  opts?: PaginationOptions,
): PaginationParams {
  const maxPage = opts?.maxPage ?? 1000;
  const maxPerPage = opts?.maxPerPage ?? 100;
  const defaultPerPage = opts?.defaultPerPage ?? 20;
  const defaultPage = opts?.defaultPage ?? 1;

  const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
  const rawPerPage = Number.parseInt(searchParams.get("per_page") ?? "", 10);

  const page = Math.min(
    maxPage,
    Math.max(1, Number.isFinite(rawPage) && rawPage > 0 ? rawPage : defaultPage),
  );
  const perPage = Math.min(
    maxPerPage,
    Math.max(
      1,
      Number.isFinite(rawPerPage) && rawPerPage > 0 ? rawPerPage : defaultPerPage,
    ),
  );

  return { page, perPage };
}

// ── expires_at ─────────────────────────────────────────

export type ValidateExpiresAtResult =
  | { valid: true; normalizedIso: string | null }
  | { valid: false; reason: string };

/**
 * Validate an optional ISO 8601 `expires_at` string.
 *
 * Returns `normalizedIso` so callers can persist a TIMESTAMPTZ-friendly value
 * without re-running the same regex/parse logic. For a date-only input
 * (`YYYY-MM-DD`), the returned ISO is normalized to end-of-day UTC so it
 * matches the comparison semantics used inside this function.
 */
export function validateExpiresAt(
  value: unknown,
  now: Date = new Date(),
): ValidateExpiresAtResult {
  if (value === undefined || value === null)
    return { valid: true, normalizedIso: null };
  if (typeof value !== "string")
    return { valid: false, reason: "Field 'expires_at' must be a string" };

  const iso8601Re =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;
  if (!iso8601Re.test(value))
    return {
      valid: false,
      reason: "Field 'expires_at' must be a valid ISO 8601 date",
    };

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    return {
      valid: false,
      reason: "Field 'expires_at' must be a valid ISO 8601 date",
    };

  // カレンダー妥当性チェック（2026-02-30 等を拒否）
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const [y, m, d] = datePart.split("-").map(Number);
  const cal = new Date(Date.UTC(y, m - 1, d));
  if (
    cal.getUTCFullYear() !== y ||
    cal.getUTCMonth() + 1 !== m ||
    cal.getUTCDate() !== d
  )
    return {
      valid: false,
      reason: "Field 'expires_at' must be a valid ISO 8601 date",
    };

  // 日付のみ形式（YYYY-MM-DD）は UTC 00:00 として解析されるため、
  // 当日終端（23:59:59.999 UTC）まで有効とみなして比較する。
  const hasTime = value.includes("T");
  const compareDate = hasTime
    ? parsed
    : new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  if (compareDate <= now)
    return {
      valid: false,
      reason: "Field 'expires_at' must be a future date",
    };

  // 日付のみ形式は保存時も当日終端に正規化する（呼び出し側の重複ロジック排除）
  const normalizedIso = hasTime ? value : `${datePart}T23:59:59.999Z`;
  return { valid: true, normalizedIso };
}
