import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { getDashboardStats, getRecentTransactions } from "@/lib/dashboard/queries";
import StatsCard from "@/components/dashboard/StatsCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { CONTENT_TYPE_LABELS } from "@/types/knowledge.types";
import type { ContentType, Token } from "@/types/database.types";

function formatToken(amount: number, token: Token): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const [stats, recentTx] = await Promise.all([
    getDashboardStats(user.id),
    getRecentTransactions(user.id, 5),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          ダッシュボード
        </h1>
        <Link
          href="/list"
          className="inline-flex items-center justify-center font-medium rounded-lg transition-colors px-4 py-2 text-base bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          新規出品
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="出品数"
          value={stats.totalListings}
          subValue={`公開中: ${stats.publishedCount}`}
          iconColor="blue"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatsCard
          label="公開中"
          value={stats.publishedCount}
          subValue={`下書き: ${stats.draftCount}`}
          iconColor="green"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          label="売上 (SOL)"
          value={formatToken(stats.totalRevenue.SOL, "SOL")}
          subValue="過去30日"
          iconColor="purple"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          label="売上 (USDC)"
          value={formatToken(stats.totalRevenue.USDC, "USDC")}
          subValue="過去30日"
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
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            最近の取引
          </h2>
          <Link
            href="/dashboard/sales"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            すべて見る
          </Link>
        </div>

        {recentTx.length === 0 ? (
          <Card padding="lg">
            <p className="text-center text-zinc-500 dark:text-zinc-400">
              まだ取引がありません
            </p>
          </Card>
        ) : (
          <Card padding="sm">
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {recentTx.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {tx.knowledge_item?.title ?? "不明なアイテム"}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {tx.knowledge_item?.content_type && (
                        <Badge>
                          {CONTENT_TYPE_LABELS[tx.knowledge_item.content_type as ContentType]}
                        </Badge>
                      )}
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {timeAgo(tx.created_at)}
                      </span>
                    </div>
                  </div>
                  <p className="ml-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
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
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          クイックアクション
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/list">
            <Card hover padding="md">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  新規出品
                </span>
              </div>
            </Card>
          </Link>
          <Link href="/dashboard/sales">
            <Card hover padding="md">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2 text-green-600 dark:bg-green-950 dark:text-green-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  売上分析
                </span>
              </div>
            </Card>
          </Link>
          <Link href="/dashboard/api-keys">
            <Card hover padding="md">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  APIキー管理
                </span>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
