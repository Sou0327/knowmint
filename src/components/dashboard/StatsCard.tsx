import { type ReactNode } from "react";
import Card from "@/components/ui/Card";

export interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: ReactNode;
  iconColor?: "blue" | "green" | "purple" | "amber";
  trend?: { value: number; label: string };
}

const ICON_COLORS = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
  purple: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
};

export default function StatsCard({
  label,
  value,
  subValue,
  icon,
  iconColor = "blue",
  trend,
}: StatsCardProps) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {value}
          </p>
          {subValue && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {subValue}
            </p>
          )}
          {trend && (
            <p
              className={`mt-1.5 text-sm font-medium ${
                trend.value >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={`ml-4 rounded-xl p-2.5 ${ICON_COLORS[iconColor]}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
