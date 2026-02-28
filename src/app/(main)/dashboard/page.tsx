import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/lib/auth/session";
import { getDashboardStats, getRecentTransactions } from "@/lib/dashboard/queries";
import StatsCard from "@/components/dashboard/StatsCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getContentDisplayLabel } from "@/types/knowledge.types";
import type { ContentType, Token } from "@/types/database.types";

function formatToken(amount: number, token: Token): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token}`;
}

function timeAgo(dateStr: string, t: (key: string, values?: Record<string, string | number | Date>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("daysAgo", { count: days });
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const [stats, recentTx, t, tCommon, tTypes] = await Promise.all([
    getDashboardStats(user.id),
    getRecentTransactions(user.id, 5),
    getTranslations("Dashboard"),
    getTranslations("Common"),
    getTranslations("Types"),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-dq-text">
          {t("overview")}
        </h1>
        <Link
          href="/list"
          className="inline-flex items-center justify-center font-medium rounded-sm transition-colors px-4 py-2 text-base bg-dq-gold text-dq-bg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-dq-gold"
        >
          {t("newListing")}
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label={t("listingCount")}
          value={stats.totalListings}
          subValue={t("publishedCount", { count: stats.publishedCount })}
          iconColor="blue"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatsCard
          label={t("salesAnalytics")}
          value={stats.publishedCount}
          subValue={t("draftCount", { count: stats.draftCount })}
          iconColor="green"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          label={t("salesSol")}
          value={formatToken(stats.totalRevenue.SOL, "SOL")}
          subValue={t("last30Days")}
          iconColor="purple"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          label={t("salesUsdc")}
          value={formatToken(stats.totalRevenue.USDC, "USDC")}
          subValue={t("last30Days")}
          iconColor="amber"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      </div>

      {/* Recent Transactions */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dq-text">
            {t("recentTransactions")}
          </h2>
          <Link
            href="/dashboard/sales"
            className="text-sm text-dq-cyan hover:text-dq-gold"
          >
            {tCommon("viewAll")}
          </Link>
        </div>

        {recentTx.length === 0 ? (
          <Card padding="lg">
            <p className="text-center text-dq-text-muted">
              {t("noTransactions")}
            </p>
          </Card>
        ) : (
          <Card padding="sm">
            <div className="divide-y divide-dq-border">
              {recentTx.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-dq-text">
                      {tx.knowledge_item?.title ?? t("unknownItem")}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {tx.knowledge_item?.content_type && (
                        <Badge>
                          {getContentDisplayLabel(tx.knowledge_item.content_type as ContentType, tTypes)}
                        </Badge>
                      )}
                      <span className="text-xs text-dq-text-muted">
                        {timeAgo(tx.created_at, t)}
                      </span>
                    </div>
                  </div>
                  <p className="ml-4 whitespace-nowrap text-sm font-semibold text-dq-green">
                    +{formatToken(Number(tx.amount), tx.token as Token)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-dq-text">
          {t("quickActions")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/list">
            <Card hover padding="md">
              <div className="flex items-center gap-3">
                <div className="rounded-sm bg-dq-cyan/10 p-2 text-dq-cyan">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-dq-text">
                  {t("newListing")}
                </span>
              </div>
            </Card>
          </Link>
          <Link href="/dashboard/sales">
            <Card hover padding="md">
              <div className="flex items-center gap-3">
                <div className="rounded-sm bg-dq-green/10 p-2 text-dq-green">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-dq-text">
                  {t("salesAnalytics")}
                </span>
              </div>
            </Card>
          </Link>
          <Link href="/dashboard/api-keys">
            <Card hover padding="md">
              <div className="flex items-center gap-3">
                <div className="rounded-sm bg-dq-purple/10 p-2 text-dq-purple">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-dq-text">
                  {t("apiKeys")}
                </span>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
