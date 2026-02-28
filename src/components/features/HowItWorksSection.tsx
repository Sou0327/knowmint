"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const STEPS = [
  { icon: "\u2699\ufe0f", key: "setup" },
  { icon: "\ud83d\udd0d", key: "discover" },
  { icon: "\u26a1", key: "autoPay" },
  { icon: "\ud83d\udcda", key: "getKnowledge" },
] as const;

const MCP_CONFIG = `{
  "mcpServers": {
    "knowmint": {
      "command": "npx",
      "args": ["--yes", "@knowmint/mcp-server@0.1.2"],
      "env": {
        "KM_API_KEY": "km_your_api_key"
      }
    }
  }
}`;

export default function HowItWorksSection() {
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(MCP_CONFIG);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }, []);

  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <h2 className="shrink-0 text-xl font-bold font-display text-dq-gold">
          {t("howItWorksTitle")}
        </h2>
        <div className="h-px flex-1 bg-dq-border" />
      </div>

      <p className="mb-8 text-sm text-dq-text-sub">
        {t("howItWorksSubtitle")}
      </p>

      {/* 4-Step Flow */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.key} className="relative">
            <div className="dq-window-sm p-5 h-full">
              {/* Step number */}
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-dq-gold/20 text-xs font-bold text-dq-gold">
                  {i + 1}
                </span>
                <span className="text-lg" role="img" aria-hidden="true">
                  {s.icon}
                </span>
              </div>

              <h3 className="mb-2 text-sm font-bold text-dq-gold">
                {t(`howItWorksStep${i + 1}Title`)}
              </h3>
              <p className="text-xs leading-relaxed text-dq-text-sub">
                {t(`howItWorksStep${i + 1}Desc`)}
              </p>
            </div>

            {/* Arrow connector (desktop only, not on last item) */}
            {i < STEPS.length - 1 && (
              <div className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-dq-gold/40 lg:block">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6 2l6 6-6 6V2z" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MCP Config Example */}
      <div className="mt-8 dq-window-sm p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-dq-cyan">
            {t("howItWorksMcpConfigTitle")}
          </h3>
          <button
            onClick={handleCopy}
            className="rounded-sm border border-dq-border px-3 py-1 text-xs text-dq-text-sub transition-colors hover:border-dq-gold/40 hover:text-dq-gold"
            type="button"
          >
            {copied ? tCommon("copied") : tCommon("copy")}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-sm bg-dq-bg p-4 text-xs leading-relaxed text-dq-text-sub">
          <code>{MCP_CONFIG}</code>
        </pre>
        <p className="mt-3 text-xs text-dq-text-muted">
          {t("howItWorksMcpConfigDesc")}
        </p>
      </div>
    </section>
  );
}
