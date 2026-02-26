"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const fetchCount = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      setUnreadCount(count ?? 0);
    };
    fetchCount();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setNotifications((data as NotificationItem[]) ?? []);
    setLoading(false);
  };

  const handleOpen = () => {
    if (!open) fetchNotifications();
    setOpen(!open);
  };

  const markAsRead = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const typeIcon: Record<string, string> = {
    purchase: "G",
    review: "★",
    follow: "♦",
    new_listing: "◆",
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-sm p-2 text-dq-text-sub transition-colors hover:bg-dq-surface hover:text-dq-gold"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-sm bg-dq-red text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 dq-window-sm">
          <div className="flex items-center justify-between border-b-2 border-dq-border px-4 py-3">
            <h3 className="text-sm font-semibold text-dq-gold">{t("title")}</h3>
            <Link
              href="/notifications"
              className="text-xs text-dq-cyan hover:text-dq-gold"
              onClick={() => setOpen(false)}
            >
              {tCommon("viewAll")}
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-dq-text-muted">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-dq-text-muted">{t("empty")}</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-dq-border/50 px-4 py-3 transition-colors last:border-0 ${
                    n.read ? "" : "bg-dq-surface/50"
                  }`}
                >
                  <div className="flex gap-2">
                    <span className="mt-0.5 text-base text-dq-gold">{typeIcon[n.type] ?? "◇"}</span>
                    <div className="min-w-0 flex-1">
                      {n.link ? (
                        <Link
                          href={n.link}
                          className="text-sm font-medium text-dq-text hover:text-dq-gold"
                          onClick={() => { markAsRead(n.id); setOpen(false); }}
                        >
                          {n.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-dq-text">{n.title}</p>
                      )}
                      <p className="mt-0.5 text-xs text-dq-text-muted line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-[10px] text-dq-text-muted">
                        {new Date(n.created_at).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US")}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(n.id)}
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-dq-cyan"
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
