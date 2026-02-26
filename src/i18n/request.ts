import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export type Locale = "en" | "ja";
export const defaultLocale: Locale = "en";
export const locales: Locale[] = ["en", "ja"];

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("km_locale")?.value;
  const locale: Locale = raw === "ja" ? "ja" : "en";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
