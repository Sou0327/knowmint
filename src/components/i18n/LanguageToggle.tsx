"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

interface LanguageToggleProps {
  compact?: boolean;
}

export default function LanguageToggle({ compact = false }: LanguageToggleProps) {
  const locale = useLocale();
  const router = useRouter();

  const switchLocale = (newLocale: string) => {
    document.cookie = `km_locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    router.refresh();
  };

  const buttonBase =
    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors";

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800 ${
        compact ? "" : "shadow-sm"
      }`}
      aria-label="Language switcher"
    >
      <button
        type="button"
        onClick={() => switchLocale("ja")}
        className={`${buttonBase} ${
          locale === "ja"
            ? "bg-blue-600 text-white"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
        }`}
        aria-pressed={locale === "ja"}
      >
        日本語
      </button>
      <button
        type="button"
        onClick={() => switchLocale("en")}
        className={`${buttonBase} ${
          locale === "en"
            ? "bg-blue-600 text-white"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
        }`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
