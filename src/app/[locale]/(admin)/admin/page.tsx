import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAdminDashboardStats } from "@/lib/admin/queries";
import StatsCard from "@/components/dashboard/StatsCard";

export default async function AdminDashboardPage() {
  // Admin guard is enforced by (admin)/layout.tsx
  const [t, stats] = await Promise.all([
    getTranslations("Admin"),
    getAdminDashboardStats(),
  ]);

  const revenueSubValue = Object.entries(stats.totalRevenue)
    .filter(([, amount]) => amount > 0)
    .map(([token, amount]) => `${amount.toFixed(4)} ${token}`)
    .join(" / ");

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-dq-gold">
        {t("dashboard")}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Users */}
        <StatsCard
          label={t("totalUsers")}
          value={stats.totalUsers}
          iconColor="blue"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />

        {/* Total Listings */}
        <StatsCard
          label={t("totalListings")}
          value={stats.totalListings}
          iconColor="green"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          }
        />

        {/* Total Transactions */}
        <StatsCard
          label={t("totalTransactions")}
          value={stats.totalTransactions}
          iconColor="purple"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          }
        />

        {/* Total Revenue */}
        <StatsCard
          label={t("totalRevenue")}
          value={`${(stats.totalRevenue["SOL"] ?? 0).toFixed(4)} SOL`}
          subValue={revenueSubValue || undefined}
          iconColor="amber"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />

        {/* Pending Reports */}
        <StatsCard
          label={t("pendingReports")}
          value={stats.pendingReports}
          iconColor={stats.pendingReports > 0 ? "amber" : "blue"}
          subValue={
            stats.pendingReports > 0
              ? `${stats.pendingReports} ${stats.pendingReports === 1 ? "report requires" : "reports require"} review`
              : undefined
          }
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-dq-text-muted uppercase tracking-wider">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/admin/reports?status=pending" as const, label: t("reports"), desc: "Review pending reports", color: "text-dq-red" },
            { href: "/admin/users" as const, label: t("users"), desc: "Manage users", color: "text-dq-cyan" },
            { href: "/admin/listings" as const, label: t("listings"), desc: "Manage listings", color: "text-dq-green" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 rounded-sm border border-dq-border bg-dq-window-bg p-4 transition-all duration-150 hover:border-dq-gold/40 hover:bg-dq-surface"
            >
              <span className={`text-lg ${action.color} transition-transform duration-150 group-hover:scale-110`}>&#9654;</span>
              <div>
                <p className="text-sm font-medium text-dq-text group-hover:text-dq-gold transition-colors">{action.label}</p>
                <p className="text-xs text-dq-text-muted">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
