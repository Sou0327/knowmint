import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNotifications } from "@/lib/notifications/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, string> = {
  purchase: "💰",
  review: "⭐",
  follow: "👤",
  new_listing: "📦",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const notifications = await getNotifications(user.id, 50);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">通知</h1>

      {notifications.length === 0 ? (
        <div className="py-12 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <p className="text-zinc-500 dark:text-zinc-400">通知はありません</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 transition-colors ${
                n.read
                  ? "border-zinc-100 dark:border-zinc-800"
                  : "border-blue-100 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/10"
              }`}
            >
              <div className="flex gap-3">
                <span className="mt-0.5 text-lg">{TYPE_ICON[n.type] ?? "📢"}</span>
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="text-sm font-medium text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{n.title}</p>
                  )}
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{n.message}</p>
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(n.created_at).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
