/**
 * Supabase nested join が T | T[] を返す場合に単一オブジェクトに正規化する。
 * 全クエリファイルから共通参照する唯一の定義。
 */
export function toSingle<T>(val: T | T[] | null | undefined): T | null {
  if (val === null || val === undefined) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}
