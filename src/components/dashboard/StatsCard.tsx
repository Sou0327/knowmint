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
  blue: "bg-dq-cyan/10 text-dq-cyan",
  green: "bg-dq-green/10 text-dq-green",
  purple: "bg-dq-purple/10 text-dq-purple",
  amber: "bg-dq-gold/10 text-dq-gold",
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
          <p className="text-sm font-medium text-dq-text-muted">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold font-display tracking-tight text-dq-gold">
            {value}
          </p>
          {subValue && (
            <p className="mt-1 text-sm text-dq-text-muted">
              {subValue}
            </p>
          )}
          {trend && (
            <p
              className={`mt-1.5 text-sm font-medium ${
                trend.value >= 0
                  ? "text-dq-green"
                  : "text-dq-red"
              }`}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={`ml-4 rounded-sm p-2.5 ${ICON_COLORS[iconColor]}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
