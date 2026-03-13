import { permanentRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";

export default async function KnowledgeIndexPage() {
  const locale = await getLocale();
  const prefix = locale === "en" ? "" : `/${locale}`;
  permanentRedirect(`${prefix}/search`);
}
