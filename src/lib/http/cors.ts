/**
 * CORS allowlist resolution (RP1 B-4).
 *
 * middleware.ts が next-intl / @supabase/ssr を副作用 import するため、
 * pure function だけをここに分離してテスト容易性を確保する。
 */

/**
 * Resolve allowed CORS origins with strict production guard.
 *
 * - `ALLOWED_ORIGINS` (CSV) は新 SSOT。後方互換で `ALLOWED_ORIGIN` 単一値も解釈。
 * - production で未設定の場合は即 throw (Worker 初回リクエストで fail-fast)。
 * - development は空配列フォールバックで DX を維持 (`resolveAllowedOrigin` 側で `*` を返す)。
 *
 * 本関数の返り値は list (allowlist)。Origin ヘッダと照合して echo する。
 */
export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGIN ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === "production" && list.length === 0) {
    throw new Error(
      "ALLOWED_ORIGINS must be set in production (comma-separated origins). " +
        "Example: ALLOWED_ORIGINS=https://knowmint.shop,https://www.knowmint.shop"
    );
  }

  return list;
}

/**
 * Origin ヘッダを allowlist と照合して echo 先を決定する。
 *
 * - allowlist に一致 → そのまま echo (safe)
 * - 不一致 + production → null (Access-Control-Allow-Origin ヘッダを出さない)
 * - 不一致 + development → "*" (開発利便性を残す)
 *
 * 呼び出し側は戻り値を Access-Control-Allow-Origin にセットし、
 * 常に `Vary: Origin` を付与してキャッシュ汚染を防ぐ。
 */
export function resolveAllowedOrigin(
  requestOrigin: string | null,
  allowedOrigins: string[]
): string | null {
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  if (process.env.NODE_ENV !== "production") {
    return "*";
  }
  return null;
}
