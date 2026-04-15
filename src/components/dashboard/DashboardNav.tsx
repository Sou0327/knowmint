"use client";

import { useTranslations } from "next-intl";
import SidebarNav, { type SidebarNavItem } from "@/components/ui/SidebarNav";
import {
  Home,
  List,
  BarChart2,
  BookOpen,
  Heart,
  Trophy,
  Key,
  Settings,
} from "lucide-react";

export default function DashboardNav() {
  const t = useTranslations("Dashboard");
  const tFav = useTranslations("Favorites");

  const PRIMARY_NAV: SidebarNavItem[] = [
    {
      label: t("overview"),
      href: "/dashboard",
      icon: <Home className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("listings"),
      href: "/dashboard/listings",
      icon: <List className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("salesAnalytics"),
      href: "/dashboard/sales",
      icon: <BarChart2 className="h-5 w-5" aria-hidden="true" />,
    },
  ];

  const SECONDARY_NAV: SidebarNavItem[] = [
    {
      label: t("purchaseHistory"),
      href: "/dashboard/purchases",
      icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: tFav("title"),
      href: "/dashboard/favorites",
      icon: <Heart className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("rankings"),
      href: "/dashboard/rankings",
      icon: <Trophy className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("apiKeys"),
      href: "/dashboard/api-keys",
      icon: <Key className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: t("settings"),
      href: "/dashboard/settings",
      icon: <Settings className="h-5 w-5" aria-hidden="true" />,
    },
  ];

  const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-24 space-y-6">
          <SidebarNav
            items={PRIMARY_NAV}
            variant="sidebar"
            rootHref="/dashboard"
          />
          <div className="border-t-2 border-dq-border" />
          <SidebarNav
            items={SECONDARY_NAV}
            variant="sidebar"
          />
        </div>
      </div>

      {/* Mobile horizontal scroll tabs */}
      <SidebarNav
        items={ALL_NAV}
        variant="tab"
        rootHref="/dashboard"
        className="lg:hidden -mx-4 mb-6 overflow-x-auto border-b-2 border-dq-border"
      />
    </>
  );
}
