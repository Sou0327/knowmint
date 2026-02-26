"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { SalesByDate } from "@/types/dashboard.types";

interface SalesChartProps {
  data: SalesByDate[];
}

interface ChartDataPoint {
  date: string;
  SOL: number;
  USDC: number;
  ETH: number;
}

export default function SalesChart({ data }: SalesChartProps) {
  const t = useTranslations("Dashboard");
  const chartData = useMemo(() => {
    const merged = new Map<string, ChartDataPoint>();
    data.forEach(({ date, amount, token }) => {
      if (!merged.has(date)) {
        merged.set(date, { date, SOL: 0, USDC: 0, ETH: 0 });
      }
      const entry = merged.get(date)!;
      if (token === "SOL") entry.SOL += amount;
      else if (token === "USDC") entry.USDC += amount;
      else if (token === "ETH") entry.ETH += amount;
    });

    return Array.from(merged.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-dq-text-muted">
        {t("noPeriodData")}
      </div>
    );
  }

  const hasSOL = chartData.some((d) => d.SOL > 0);
  const hasUSDC = chartData.some((d) => d.USDC > 0);
  const hasETH = chartData.some((d) => d.ETH > 0);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-dq-border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "var(--color-dq-text-muted)" }}
          tickFormatter={(v: string) => {
            const parts = v.split("-");
            return `${Number(parts[1])}/${Number(parts[2])}`;
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: "var(--color-dq-text-muted)" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-dq-window-bg)",
            border: "2px solid var(--color-dq-border-outer)",
            borderRadius: 2,
            color: "var(--color-dq-text)",
          }}
          labelFormatter={(v) => {
            const parts = String(v).split("-");
            return `${parts[0]}/${Number(parts[1])}/${Number(parts[2])}`;
          }}
        />
        <Legend />
        {hasSOL && <Bar dataKey="SOL" fill="var(--color-dq-purple)" radius={[2, 2, 0, 0]} />}
        {hasUSDC && <Bar dataKey="USDC" fill="var(--color-dq-cyan)" radius={[2, 2, 0, 0]} />}
        {hasETH && <Bar dataKey="ETH" fill="var(--color-dq-gold)" radius={[2, 2, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  );
}
