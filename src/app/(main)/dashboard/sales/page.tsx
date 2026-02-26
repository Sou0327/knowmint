"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { SalesByDate, TopSellingItem, RevenueByToken } from "@/types/dashboard.types";
import type { Token } from "@/types/database.types";

function ChartLoadingFallback() {
  const t = useTranslations("Dashboard");
  return (
    <div className="flex h-80 items-center justify-center text-dq-text-muted">
      {t("chartLoading")}
    </div>
  );
}

const SalesChart = dynamic(
  () => import("@/components/dashboard/SalesChart"),
  {
    loading: () => <ChartLoadingFallback />,
    ssr: false,
  }
);

type Period = "7d" | "30d" | "90d" | "all";

function getStartDate(period: Period): Date | null {
  if (period === "all") return null;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[period];
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function formatRevenue(revenueByToken: Partial<Record<Token, number>>): string {
  const parts: string[] = [];
  if (revenueByToken.SOL) parts.push(`${revenueByToken.SOL.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`);
  if (revenueByToken.USDC) parts.push(`${revenueByToken.USDC.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`);
  if (revenueByToken.ETH) parts.push(`${revenueByToken.ETH.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`);
  return parts.length > 0 ? parts.join(", ") : "-";
}

export default function SalesPage() {
  const t = useTranslations("Dashboard");

  const PERIOD_LABELS: Record<Period, string> = {
    "7d": t("period7d"),
    "30d": t("period30d"),
    "90d": t("period90d"),
    all: t("periodAll"),
  };

  const [period, setPeriod] = useState<Period>("30d");
  const [salesData, setSalesData] = useState<SalesByDate[]>([]);
  const [topItems, setTopItems] = useState<TopSellingItem[]>([]);
  const [revenueByToken, setRevenueByToken] = useState<RevenueByToken[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const start = getStartDate(period);
    const end = new Date();

    // Fetch transactions and top items in parallel
    let txQuery = supabase
      .from("transactions")
      .select("amount, token, created_at")
      .eq("seller_id", user.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    if (start) {
      txQuery = txQuery.gte("created_at", start.toISOString());
    }
    txQuery = txQuery.lte("created_at", end.toISOString());

    const itemsQuery = supabase
      .from("knowledge_items")
      .select("id, title, purchase_count, average_rating")
      .eq("seller_id", user.id)
      .eq("status", "published")
      .order("purchase_count", { ascending: false })
      .limit(5);

    const [{ data: transactions }, { data: items }] = await Promise.all([
      txQuery,
      itemsQuery,
    ]);

    // Build salesData + revenueByToken from transactions
    const byDate = new Map<string, Map<Token, number>>();
    const tokenTotals = new Map<Token, { total: number; count: number }>();

    (transactions ?? []).forEach((tx) => {
      const date = tx.created_at.split("T")[0];
      if (!byDate.has(date)) byDate.set(date, new Map());
      const tokenMap = byDate.get(date)!;
      const token = tx.token as Token;
      tokenMap.set(token, (tokenMap.get(token) ?? 0) + Number(tx.amount));

      if (!tokenTotals.has(token)) tokenTotals.set(token, { total: 0, count: 0 });
      const tt = tokenTotals.get(token)!;
      tt.total += Number(tx.amount);
      tt.count++;
    });

    const sales: SalesByDate[] = [];
    byDate.forEach((tokenMap, date) => {
      tokenMap.forEach((amount, token) => {
        sales.push({ date, amount, token });
      });
    });
    setSalesData(sales);

    const revenue: RevenueByToken[] = [];
    tokenTotals.forEach((v, token) => {
      revenue.push({ token, total: v.total, count: v.count });
    });
    setRevenueByToken(revenue);

    // Build top items with per-token revenue
    if (items && items.length > 0) {
      const itemIds = items.map((i) => i.id);
      const { data: itemTxs } = await supabase
        .from("transactions")
        .select("knowledge_item_id, amount, token")
        .eq("seller_id", user.id)
        .eq("status", "confirmed")
        .in("knowledge_item_id", itemIds);

      const revenueMap = new Map<string, Partial<Record<Token, number>>>();
      itemTxs?.forEach((tx) => {
        if (!revenueMap.has(tx.knowledge_item_id)) {
          revenueMap.set(tx.knowledge_item_id, {});
        }
        const byToken = revenueMap.get(tx.knowledge_item_id)!;
        const token = tx.token as Token;
        byToken[token] = (byToken[token] ?? 0) + Number(tx.amount);
      });

      setTopItems(
        items.map((item) => ({
          id: item.id,
          title: item.title,
          salesCount: item.purchase_count,
          revenueByToken: revenueMap.get(item.id) ?? {},
          averageRating: item.average_rating,
        }))
      );
    } else {
      setTopItems([]);
    }

    setLoading(false);
  }, [period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-dq-text">
          {t("salesAnalytics")}
        </h1>
        <div className="flex gap-2" role="group" aria-label={t("periodSelect")}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "primary" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-dq-gold border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Revenue by Token */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {(["SOL", "USDC", "ETH"] as Token[]).map((token) => {
              const r = revenueByToken.find((rv) => rv.token === token);
              return (
                <Card key={token} padding="md">
                  <p className="text-sm font-medium text-dq-text-muted">
                    {token} {t("revenue")}
                  </p>
                  <p className="mt-1 text-xl font-bold text-dq-text">
                    {(r?.total ?? 0).toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}{" "}
                    {token}
                  </p>
                  <p className="text-sm text-dq-text-muted">
                    {t("transactionCount", { count: r?.count ?? 0 })}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Sales Chart */}
          <Card padding="md" className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-dq-text">
              {t("dailySalesTrend")}
            </h2>
            <SalesChart data={salesData} />
          </Card>

          {/* Top Sellers */}
          <Card padding="md">
            <h2 className="mb-4 text-lg font-semibold text-dq-text">
              {t("topSellingItems")}
            </h2>
            {topItems.length === 0 ? (
              <p className="text-center text-dq-text-muted py-4">
                {t("noPeriodData")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dq-border">
                      <th className="py-2 text-left font-medium text-dq-text-muted">
                        {t("title")}
                      </th>
                      <th className="py-2 text-right font-medium text-dq-text-muted">
                        {t("sales")}
                      </th>
                      <th className="py-2 text-right font-medium text-dq-text-muted">
                        {t("revenue")}
                      </th>
                      <th className="py-2 text-right font-medium text-dq-text-muted">
                        {t("rating")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dq-border">
                    {topItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 text-dq-text">
                          {item.title}
                        </td>
                        <td className="py-2.5 text-right text-dq-text-sub">
                          {item.salesCount}
                        </td>
                        <td className="py-2.5 text-right text-sm text-dq-text">
                          {formatRevenue(item.revenueByToken)}
                        </td>
                        <td className="py-2.5 text-right">
                          {item.averageRating ? (
                            <Badge variant="success">
                              {item.averageRating.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-dq-text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
