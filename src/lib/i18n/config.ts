export type Locale = "ja" | "en";

export const LOCALE_COOKIE_KEY = "km_locale";

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "ja";
}
