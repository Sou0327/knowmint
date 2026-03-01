/**
 * Translate a category slug to a localised display name.
 * Falls back to the raw DB `name` when no translation key exists.
 *
 * Expects `tTypes` from `getTranslations("Types")` (server) or `useTranslations("Types")` (client).
 */
export function getCategoryDisplayName(
  tTypes: { has: (key: string) => boolean } & ((key: string) => string),
  slug: string,
  fallbackName: string,
): string {
  const key = `category.${slug}`;
  if (tTypes.has(key)) {
    return (tTypes as (k: string) => string)(key);
  }
  return fallbackName;
}
