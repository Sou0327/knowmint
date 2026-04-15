/**
 * i18n date helpers.
 *
 * Centralizes the `locale === "ja" ? "ja-JP" : "en-US"` mapping that was
 * duplicated in many client components. Next-intl gives us short locale
 * codes ("ja" / "en") but `Intl.DateTimeFormat` prefers BCP-47 tags
 * ("ja-JP" / "en-US"). This module bridges them.
 */

export type SupportedLocale = "ja-JP" | "en-US";

/**
 * Map a next-intl short locale code to a BCP-47 tag understood by
 * `Intl.DateTimeFormat`. Unknown values fall through to "en-US" so
 * downstream UI never crashes on a missing locale.
 */
export function toDateLocale(locale: string): SupportedLocale {
  return locale === "ja" ? "ja-JP" : "en-US";
}

/**
 * Format an ISO date string using the user's locale. `undefined` or an
 * unparseable input returns the empty string so callers can render safely.
 */
export function formatDate(
  isoString: string | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(toDateLocale(locale), options);
}

/** Same as `formatDate` but includes the time component. */
export function formatDateTime(
  isoString: string | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(toDateLocale(locale), options);
}
