"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";

interface ShareCardProps {
  title: string;
  itemId: string;
  onClose: () => void;
}

export default function ShareCard({ title, itemId, onClose }: ShareCardProps) {
  const t = useTranslations("ShareCard");
  const tCommon = useTranslations("Common");
  const [copied, setCopied] = useState(false);

  const itemUrl = `https://knowmint.shop/knowledge/${itemId}`;
  const tweetText = t("tweetText", { title });
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(itemUrl)}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(itemUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <span>𝕏</span> Post on X
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
