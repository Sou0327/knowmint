"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

interface AdminSearchBarProps {
  placeholder: string;
}

export default function AdminSearchBar({ placeholder }: AdminSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const currentSearch = searchParams.get("search") ?? "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = (formData.get("search") as string).trim();
    const params = new URLSearchParams(searchParams.toString());
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleClear() {
    if (inputRef.current) inputRef.current.value = "";
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2" role="search">
      <div className="relative flex-1" key={currentSearch}>
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dq-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          name="search"
          defaultValue={currentSearch}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-sm border border-dq-border bg-dq-surface py-2 pl-9 pr-8 text-sm text-dq-text placeholder:text-dq-text-muted focus:border-dq-gold focus:outline-none focus:ring-1 focus:ring-dq-gold/30 transition-colors"
        />
        {currentSearch && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-dq-text-muted hover:text-dq-text transition-colors"
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="cursor-pointer rounded-sm bg-dq-gold px-4 py-2 text-sm font-medium text-dq-bg hover:brightness-110 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-dq-gold/50"
      >
        {isPending ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-dq-bg border-t-transparent" />
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </button>
    </form>
  );
}
