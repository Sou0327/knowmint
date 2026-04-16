import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import enMessages from "../../messages/en.json";
import jaMessages from "../../messages/ja.json";

export type Locale = "en" | "ja";
export const defaultLocale: Locale = routing.defaultLocale;
export const locales: Locale[] = [...routing.locales];

// Cloudflare Workers の bundler は template literal の dynamic import
// (`messages/${locale}.json`) を解決できず、runtime で空 messages に
// フォールバックして全テキストが en (defaultLocale) になる症状を起こす。
// 全 locale を static import で bundle に焼き込み、locale で分岐する。
const MESSAGES: Record<Locale, typeof enMessages> = {
  en: enMessages,
  ja: jaMessages,
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: MESSAGES[locale as Locale],
  };
});
