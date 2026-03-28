"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

function NavLink({
  item,
  isActive,
  variant,
}: {
  item: { label: string; href: string; icon: React.ReactNode };
  isActive: boolean;
  variant: "sidebar" | "tab";
}) {
  if (variant === "tab") {
    return (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
          isActive
            ? "border-dq-gold text-dq-gold"
            : "border-transparent text-dq-text-muted hover:text-dq-text-sub"
        }`}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        isActive
          ? "bg-dq-surface text-dq-gold"
          : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
      }`}
    >
      {isActive && (
        <span className="dq-cursor text-dq-gold">&#9654;</span>
      )}
      <span
        className={`transition-colors ${
          isActive
            ? "text-dq-gold"
            : "text-dq-text-muted group-hover:text-dq-text-sub"
        }`}
      >
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

function isItemActive(href: string, pathname: string): boolean {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname.startsWith(href);
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("Admin");

  const NAV_ITEMS = [
    {
      label: t("dashboard"),
      href: "/admin",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: t("users"),
      href: "/admin/users",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      label: t("reports"),
      href: "/admin/reports",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
      ),
    },
    {
      label: t("listings"),
      href: "/admin/listings",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: t("transactions"),
      href: "/admin/transactions",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
    {
      label: t("apiKeys"),
      href: "/admin/api-keys",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <nav aria-label="Admin navigation" className="hidden lg:block w-56 shrink-0 border-r border-dq-border bg-dq-window-bg">
        <div className="sticky top-0 p-4 space-y-1">
          <div className="mb-6 px-3">
            <h2 className="text-lg font-bold font-display text-dq-gold">Admin</h2>
            <p className="text-xs text-dq-text-muted">KnowMint</p>
          </div>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  isActive={isItemActive(item.href, pathname)}
                  variant="sidebar"
                />
              </li>
            ))}
          </ul>
          <div className="border-t border-dq-border pt-4 mt-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-dq-text-muted hover:text-dq-text-sub transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              {t("backToSite")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile horizontal scroll tabs */}
      <nav aria-label="Admin navigation" className="lg:hidden fixed top-0 left-0 right-0 z-50 overflow-x-auto border-b-2 border-dq-border bg-dq-window-bg">
        <ul className="flex min-w-max px-4">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                isActive={isItemActive(item.href, pathname)}
                variant="tab"
              />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
