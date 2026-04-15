"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";

interface LanguageToggleProps {
  compact?: boolean;
}

export default function LanguageToggle({ compact = false }: LanguageToggleProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("Nav");

  const switchLocale = (newLocale: "en" | "ja") => {
    const qs = searchParams.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    router.replace(href, { locale: newLocale });
  };

  const buttonBase =
    "rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors";

  return (
    <div
      role="group"
      className={`inline-flex items-center rounded-sm border border-dq-border bg-dq-surface p-1 ${
        compact ? "" : "shadow-sm"
      }`}
      aria-label={t("languageSwitcher")}
    >
      <button
        type="button"
        onClick={() => switchLocale("ja")}
        className={`${buttonBase} ${
          locale === "ja"
            ? "bg-dq-gold text-dq-bg"
            : "text-dq-text-sub hover:bg-dq-hover hover:text-dq-text"
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
            ? "bg-dq-gold text-dq-bg"
            : "text-dq-text-sub hover:bg-dq-hover hover:text-dq-text"
        }`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
