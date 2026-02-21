"use client";

import { useMemo } from "react";
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
      <div className="flex h-64 items-center justify-center text-zinc-500 dark:text-zinc-400">
        この期間のデータはありません
      </div>
    );
  }

  // Only show bars for tokens that have data
  const hasSOL = chartData.some((d) => d.SOL > 0);
  const hasUSDC = chartData.some((d) => d.USDC > 0);
  const hasETH = chartData.some((d) => d.ETH > 0);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#71717a" }}
          tickFormatter={(v: string) => {
            const parts = v.split("-");
            return `${Number(parts[1])}/${Number(parts[2])}`;
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: "#71717a" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            color: "#f4f4f5",
          }}
          labelFormatter={(v) => {
            const parts = String(v).split("-");
            return `${parts[0]}/${Number(parts[1])}/${Number(parts[2])}`;
          }}
        />
        <Legend />
        {hasSOL && <Bar dataKey="SOL" fill="#9945FF" radius={[4, 4, 0, 0]} />}
        {hasUSDC && <Bar dataKey="USDC" fill="#2775CA" radius={[4, 4, 0, 0]} />}
        {hasETH && <Bar dataKey="ETH" fill="#627EEA" radius={[4, 4, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  );
}
