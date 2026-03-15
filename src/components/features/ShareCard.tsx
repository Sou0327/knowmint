"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Button from "@/components/ui/Button";

interface ShareCardProps {
  title: string;
  itemId: string;
  onClose: () => void;
}

export default function ShareCard({ title, itemId, onClose }: ShareCardProps) {
  const t = useTranslations("ShareCard");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const itemUrl = `https://knowmint.shop${localePrefix}/knowledge/${itemId}`;
  const tweetText = t("tweetText", { title });
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(itemUrl)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(itemUrl);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS) — silently ignore
    }
  }

  return (
    <div className="dq-window p-6 text-center">
      <h3 className="font-display text-xl font-bold text-dq-gold mb-2">
        {t("title")}
      </h3>
      <p className="text-dq-text-sub text-sm mb-6">
        {t("shareText")}
      </p>

      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-base font-medium rounded-sm border-2 border-dq-border bg-dq-surface text-dq-text hover:bg-dq-hover transition-colors"
        >
          <span>𝕏</span> {t("postOnX")}
        </a>

        <Button variant="outline" onClick={handleCopy}>
          {copied ? tCommon("copied") : t("copyLink")}
        </Button>

        <Button variant="ghost" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </div>
  );
}
