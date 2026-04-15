"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import SidebarNav, { type SidebarNavItem } from "@/components/ui/SidebarNav";
import {
  Home,
  Users,
  Flag,
  List,
  CreditCard,
  Key,
  ArrowLeft,
} from "lucide-react";

export default function AdminSidebar() {
  const t = useTranslations("Admin");

  const NAV_ITEMS: SidebarNavItem[] = [
    {
      label: t("dashboard"),
      href: "/admin",
      icon: <Home className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("users"),
      href: "/admin/users",
      icon: <Users className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("reports"),
      href: "/admin/reports",
      icon: <Flag className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("listings"),
      href: "/admin/listings",
      icon: <List className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("transactions"),
      href: "/admin/transactions",
      icon: <CreditCard className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("apiKeys"),
      href: "/admin/api-keys",
      icon: <Key className="h-5 w-5" aria-hidden="true" />,
    },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-56 shrink-0 border-r border-dq-border bg-dq-window-bg">
        <div className="sticky top-0 p-4">
          <div className="mb-6 px-3">
            <h2 className="text-lg font-bold font-display text-dq-gold">Admin</h2>
            <p className="text-xs text-dq-text-muted">KnowMint</p>
          </div>
          <SidebarNav
            items={NAV_ITEMS}
            variant="sidebar"
            rootHref="/admin"
            ariaLabel="Admin navigation"
          />
          <div className="border-t border-dq-border pt-4 mt-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-dq-text-muted hover:text-dq-text-sub transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("backToSite")}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile horizontal scroll tabs */}
      <SidebarNav
        items={NAV_ITEMS}
        variant="tab"
        rootHref="/admin"
        ariaLabel="Admin navigation"
        className="lg:hidden fixed top-0 left-0 right-0 z-50 overflow-x-auto border-b-2 border-dq-border bg-dq-window-bg"
      />
    </>
  );
}
