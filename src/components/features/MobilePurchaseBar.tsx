"use client";

import { useState, useEffect } from "react";

interface MobilePurchaseBarProps {
  priceSol: number | null;
  knowledgeId: string;
  priceLabel: string;
  buyLabel: string;
  isRequest: boolean;
}

export default function MobilePurchaseBar({
  priceSol,
  priceLabel,
  buyLabel,
}: MobilePurchaseBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sidebar = document.getElementById("purchase-sidebar");
    if (!sidebar) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sidebar);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-dq-border bg-dq-window-bg/95 backdrop-blur-sm p-4 lg:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <div>
          <p className="text-xs text-dq-text-muted">{priceLabel}</p>
          {priceSol !== null && (
            <p className="text-lg font-bold font-display text-dq-gold">
              {priceSol} SOL
            </p>
          )}
        </div>
        <a
          href="#purchase-sidebar"
          className="rounded-sm bg-dq-gold px-6 py-3 text-sm font-bold text-dq-bg shadow-[0_0_20px_rgba(245,197,66,0.3)] transition-all hover:brightness-110"
        >
          {buyLabel}
        </a>
      </div>
    </div>
  );
}
