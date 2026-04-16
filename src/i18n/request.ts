import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import enMessages from "../../messages/en.json";

export type Locale = "en" | "ja";
export const defaultLocale: Locale = routing.defaultLocale;
export const locales: Locale[] = [...routing.locales];

type Messages = typeof enMessages;

// CF Workers の 3 MiB bundle 上限対策:
//   - en (defaultLocale): static import で bundle に焼き込み (即時 resolve)
//   - ja: public/messages/ja.json を CF ASSETS binding から runtime fetch
//     (bundle size 約 15KB gzip 削減)
// Node.js dev server では ASSETS binding が無いため、static import 済みの
// en にフォールバックする。i18n テスト用途なら dev でも public/messages を
// fetch できるよう origin を別途設定するのが理想だが、開発体験より本番
// size 上限を優先。
const jaCache: { value: Messages | null } = { value: null };

async function loadJaMessages(): Promise<Messages> {
  if (jaCache.value) return jaCache.value;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const assets = (
      ctx?.env as { ASSETS?: { fetch: (req: Request) => Promise<Response> } } | undefined
    )?.ASSETS;
    if (assets) {
      const res = await assets.fetch(
        new Request("https://_/messages/ja.json"),
      );
      if (res.ok) {
        const parsed = (await res.json()) as Messages;
        jaCache.value = parsed;
        return parsed;
      }
      console.error("[i18n] ja.json fetch failed", res.status);
    }
  } catch (err) {
    // dev server 等 ASSETS binding が無い環境: en にフォールバック
    console.warn("[i18n] ja messages not available via ASSETS binding", err);
  }

  return enMessages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  if (locale === "ja") {
    const messages = await loadJaMessages();
    return { locale, messages };
  }

  return { locale, messages: enMessages };
});
