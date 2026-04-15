"use client";

import { type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

export interface SidebarNavProps {
  items: SidebarNavItem[];
  /** Layout variant. `sidebar` = vertical; `tab` = horizontal scroll. */
  variant?: "sidebar" | "tab";
  /**
   * Route that should match *exactly* instead of prefix.
   * Example: `/admin` should not be active for `/admin/users`.
   */
  rootHref?: string;
  ariaLabel?: string;
  className?: string;
}

function isItemActive(
  href: string,
  pathname: string,
  rootHref?: string,
): boolean {
  if (rootHref && href === rootHref) {
    return pathname === rootHref;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  isActive,
  variant,
}: {
  item: SidebarNavItem;
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
        <span className="dq-cursor text-dq-gold" aria-hidden="true">
          &#9654;
        </span>
      )}
      {item.icon && (
        <span
          className={`transition-colors ${
            isActive
              ? "text-dq-gold"
              : "text-dq-text-muted group-hover:text-dq-text-sub"
          }`}
        >
          {item.icon}
        </span>
      )}
      {item.label}
    </Link>
  );
}

/**
 * Shared navigation component for `AdminSidebar` and `DashboardNav`.
 *
 * - `variant="sidebar"` — vertical stacked layout.
 * - `variant="tab"` — horizontally scrollable tab bar (mobile).
 *
 * `rootHref` lets the consumer pin a single item to exact-match so
 * `/admin` does not stay active for `/admin/users`.
 */
export default function SidebarNav({
  items,
  variant = "sidebar",
  rootHref,
  ariaLabel,
  className = "",
}: SidebarNavProps) {
  const pathname = usePathname();

  if (variant === "tab") {
    return (
      <nav aria-label={ariaLabel} className={className}>
        <ul className="flex min-w-max">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                isActive={isItemActive(item.href, pathname, rootHref)}
                variant="tab"
              />
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink
              item={item}
              isActive={isItemActive(item.href, pathname, rootHref)}
              variant="sidebar"
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
