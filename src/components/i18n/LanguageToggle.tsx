"use client";

import { useI18n } from "@/contexts/I18nContext";

interface LanguageToggleProps {
  compact?: boolean;
}

export default function LanguageToggle({ compact = false }: LanguageToggleProps) {
  const { locale, setLocale } = useI18n();

  const buttonBase =
    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors";

  return (
    <div
      data-i18n-skip="true"
      className={`inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800 ${
        compact ? "" : "shadow-sm"
      }`}
      aria-label="Language switcher"
    >
      <button
        type="button"
        onClick={() => setLocale("ja")}
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
        onClick={() => setLocale("en")}
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
