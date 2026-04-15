"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useNotifications } from "@/hooks/useNotifications";
import { usePopover } from "@/hooks/usePopover";
import { formatDate } from "@/lib/i18n/date";

export default function NotificationBell() {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
  } = useNotifications();
  const {
    open,
    close,
    triggerRef,
    panelRef,
    setOpen,
  } = usePopover();

  const handleToggle = () => {
    // When opening, fetch the latest notifications. When closing, no-op.
    if (!open) {
      setOpen(true);
      // Fetch outside the state setter to avoid concurrent-render warnings.
      queueMicrotask(() => {
        fetchNotifications();
      });
    } else {
      setOpen(false);
    }
  };

  const typeIcon: Record<string, string> = {
    purchase: "G",
    review: "★",
    follow: "♦",
    new_listing: "◆",
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="relative rounded-sm p-2 text-dq-text-sub transition-colors hover:bg-dq-surface hover:text-dq-gold focus:outline-none focus:ring-2 focus:ring-dq-gold"
        aria-label={t("title")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-sm bg-dq-red text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={t("title")}
          className="absolute right-0 z-50 mt-2 w-80 dq-window-sm"
        >
          <div className="flex items-center justify-between border-b-2 border-dq-border px-4 py-3">
            <h3 className="text-sm font-semibold text-dq-gold">{t("title")}</h3>
            <Link
              href="/notifications"
              className="text-xs text-dq-cyan hover:text-dq-gold"
              onClick={close}
            >
              {tCommon("viewAll")}
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-dq-text-muted">{tCommon("loading")}</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-dq-text-muted">{t("empty")}</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  role="menuitem"
                  className={`border-b border-dq-border/50 px-4 py-3 transition-colors last:border-0 ${
                    n.read ? "" : "bg-dq-surface/50"
                  }`}
                >
                  <div className="flex gap-2">
                    <span className="mt-0.5 text-base text-dq-gold" aria-hidden="true">{typeIcon[n.type] ?? "◇"}</span>
                    <div className="min-w-0 flex-1">
                      {n.link ? (
                        <Link
                          href={n.link}
                          className="text-sm font-medium text-dq-text hover:text-dq-gold"
                          onClick={() => { markAsRead(n.id); close(); }}
                        >
                          {n.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-dq-text">{n.title}</p>
                      )}
                      <p className="mt-0.5 text-xs text-dq-text-muted line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-[10px] text-dq-text-muted">
                        {formatDate(n.created_at, locale)}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(n.id)}
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-dq-cyan focus:outline-none focus:ring-2 focus:ring-dq-gold"
                        aria-label={t("markAsRead")}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
