import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { CONTENT_TYPE_LABELS } from "@/types/knowledge.types";
import type { ContentType } from "@/types/database.types";

export default async function LibraryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

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
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        マイライブラリ
      </h1>

      {!purchases || purchases.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-4">
            <svg
              className="mx-auto mb-4 h-16 w-16 text-zinc-300 dark:text-zinc-600"
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
            <p className="text-base text-zinc-500 dark:text-zinc-400">
              購入した知識はまだありません
            </p>
            <Link
              href="/search"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              マーケットを探す
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {purchases.map((purchase) => {
            const item = purchase.knowledge_item as unknown as {
              id: string;
              title: string;
              description: string;
              content_type: ContentType;
              seller: { display_name: string | null };
            };
            if (!item) return null;
            return (
              <Link key={purchase.id} href={`/library/${item.id}`} className="group">
                <Card hover padding="md" className="h-full transition-all duration-200 group-hover:border-blue-200 dark:group-hover:border-blue-800/50">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <Badge>{CONTENT_TYPE_LABELS[item.content_type]}</Badge>
                    </div>
                    <h3 className="font-semibold text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
                      {item.title}
                    </h3>
                    <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        {item.seller?.display_name || "匿名"} ・{" "}
                        {new Date(purchase.created_at).toLocaleDateString("ja-JP")}
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
