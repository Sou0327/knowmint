import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toSingle } from "@/lib/supabase/utils";
import { getUser } from "@/lib/auth/session";
import { getTranslations, getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getContentDisplayLabel } from "@/types/knowledge.types";

export default async function LibraryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Library");
  const tCommon = await getTranslations("Common");
  const tTypes = await getTranslations("Types");
  const locale = await getLocale();

  const supabase = await createClient();

  const { data: purchases } = await supabase
    .from("transactions")
    .select(
      `
      id,
      created_at,
      knowledge_item:knowledge_items(
        id, title, description, content_type,
        seller:profiles!seller_id(display_name)
      )
    `
    )
    .eq("buyer_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold font-display tracking-tight text-dq-text">
        {t("title")}
      </h1>

      {!purchases || purchases.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-4">
            <svg
              className="mx-auto mb-4 h-16 w-16 text-dq-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
            <p className="text-base text-dq-text-muted">
              {t("noItems")}
            </p>
            <Link
              href="/search"
              className="mt-5 inline-flex items-center gap-2 rounded-sm bg-dq-gold px-4 py-2 text-sm font-medium text-dq-bg transition-colors hover:bg-dq-gold/80"
            >
              {t("exploreMarket")}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {purchases.map((purchase) => {
            const item = toSingle(purchase.knowledge_item);
            if (!item) return null;
            const seller = toSingle(item.seller);
            return (
              <Link key={purchase.id} href={`/library/${item.id}`} className="group">
                <Card hover padding="md" className="h-full transition-all duration-200 group-hover:border-dq-gold/50">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <Badge>{getContentDisplayLabel(item.content_type, tTypes)}</Badge>
                    </div>
                    <h3 className="font-semibold text-dq-text transition-colors group-hover:text-dq-gold">
                      {item.title}
                    </h3>
                    <p className="line-clamp-2 text-sm text-dq-text-sub">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-dq-text-muted">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        {seller?.display_name || tCommon("anonymous")} ・{" "}
                        {new Date(purchase.created_at).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US")}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
