"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface SearchBarProps {
  defaultValue?: string;
  className?: string;
}

export default function SearchBar({ defaultValue = "", className = "" }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const router = useRouter();
  const t = useTranslations("Search");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchKnowledge")}
          className="peer h-11 w-full rounded-sm border-2 border-dq-border bg-dq-surface py-2 pl-10 pr-4 text-sm text-dq-text placeholder:text-dq-text-muted focus:border-dq-gold focus:outline-none focus:ring-2 focus:ring-dq-gold/30 transition-colors"
        />
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dq-text-muted transition-colors peer-focus:text-dq-gold"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </form>
  );
}
