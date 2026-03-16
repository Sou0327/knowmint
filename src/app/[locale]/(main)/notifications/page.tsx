import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNotifications } from "@/lib/notifications/queries";
import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import LucideIcon from "@/components/ui/LucideIcon";
import MarkAllReadButton from "@/components/features/MarkAllReadButton";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  purchase: { icon: "Coins", color: "text-dq-gold" },
  review: { icon: "Star", color: "text-dq-gold" },
  follow: { icon: "UserPlus", color: "text-dq-cyan" },
  new_listing: { icon: "Package", color: "text-dq-green" },
};
const DEFAULT_ICON = { icon: "Bell", color: "text-dq-text-muted" };

export default async function NotificationsPage() {
  const t = await getTranslations("Notifications");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const notifications = await getNotifications(user.id, 50);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-dq-text">{t("title")}</h1>
        {notifications.some(n => !n.read) && (
          <MarkAllReadButton label={t("markAllRead")} />
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-12 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-dq-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <p className="text-dq-text-muted">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-sm border p-4 transition-colors ${
                n.read
                  ? "border-dq-border"
                  : "border-dq-border border-l-4 border-l-dq-gold bg-dq-surface"
              }`}
            >
              <div className="flex gap-3">
                <LucideIcon
                  name={(TYPE_ICON[n.type] ?? DEFAULT_ICON).icon}
                  size={20}
                  className={`mt-0.5 shrink-0 ${(TYPE_ICON[n.type] ?? DEFAULT_ICON).color}`}
                />
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="text-sm font-medium text-dq-text hover:text-dq-cyan"
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-dq-text">{n.title}</p>
                  )}
                  <p className="mt-1 text-sm text-dq-text-sub">{n.message}</p>
                  <p className="mt-2 text-xs text-dq-text-muted">
                    {new Date(n.created_at).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
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
