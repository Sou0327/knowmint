"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

interface McpConfigPanelProps {
  toggleLabel: string;
  toggleCloseLabel: string;
  configTitle: string;
  configDesc: string;
  copyLabel: string;
  copiedLabel: string;
}

export default function McpConfigPanel({
  toggleLabel,
  toggleCloseLabel,
  configTitle,
  configDesc,
  copyLabel,
  copiedLabel,
}: McpConfigPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
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
    <div id="mcp-config-panel" className="mt-8">
      <button
        onClick={() => setShowConfig(!showConfig)}
        className="flex items-center gap-2 text-sm text-dq-cyan transition-colors hover:text-dq-gold"
        type="button"
        aria-expanded={showConfig}
        aria-controls="mcp-config-content"
      >
        <span>{showConfig ? toggleCloseLabel : toggleLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          className={`transition-transform duration-200 ${showConfig ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4H2z" />
        </svg>
      </button>

      {showConfig && (
        <div id="mcp-config-content" className="mt-4 dq-window-sm p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-dq-cyan">
              {configTitle}
            </h3>
            <button
              onClick={handleCopy}
              className="rounded-sm border border-dq-border px-3 py-1 text-xs text-dq-text-sub transition-colors hover:border-dq-gold/40 hover:text-dq-gold"
              type="button"
            >
              {copied ? copiedLabel : copyLabel}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-sm bg-dq-bg p-4 text-xs leading-relaxed text-dq-text-sub">
            <code>{MCP_CONFIG}</code>
          </pre>
          <p className="mt-3 text-xs text-dq-text-muted">{configDesc}</p>
        </div>
      )}
    </div>
  );
}
