export type ValidateExpiresAtResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateExpiresAt(
  value: unknown,
  now: Date = new Date()
): ValidateExpiresAtResult {
  if (value === undefined || value === null) return { valid: true };
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
  if (isNaN(parsed.getTime()))
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
  // タイムゾーン依存の誤拒否を防ぐための正規化。
  const compareDate = value.includes("T")
    ? parsed
    : new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  if (compareDate <= now)
    return {
      valid: false,
      reason: "Field 'expires_at' must be a future date",
    };

  return { valid: true };
}
