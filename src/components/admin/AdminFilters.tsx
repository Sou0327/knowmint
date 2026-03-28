"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  name: string;
  label: string;
  options: FilterOption[];
}

interface AdminFiltersProps {
  filters: FilterConfig[];
}

export default function AdminFilters({ filters }: AdminFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      {filters.map((filter) => (
        <div key={filter.name} className="flex flex-col gap-1">
          <label className="text-xs text-dq-text-muted">{filter.label}</label>
          <select
            value={searchParams.get(filter.name) ?? "all"}
            onChange={(e) => handleChange(filter.name, e.target.value)}
            className="bg-dq-surface border border-dq-border text-dq-text text-sm rounded-sm px-3 py-2 focus:border-dq-gold focus:outline-none"
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
