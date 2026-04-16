"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import SearchBar from "@/components/features/SearchBar";
import HeroParticles from "@/components/features/HeroParticles";

interface HomeHeroSectionProps {
  translations: {
    heroCatchphrase: string;
    heroTagline: string;
    exploreMarket: string;
    heroSubCtaLabel: string;
    heroSellerCta: string;
    heroSellerCtaLink: string;
  };
}

const BADGES = [
  { label: "x402 Protocol", color: "text-dq-cyan" },
  { label: "Solana", color: "text-dq-gold" },
  { label: "MCP", color: "text-dq-text-sub" },
] as const;

const SEARCH_TAGS = ["MCP", "prompt", "Claude Code", "dataset", "Solana"];

export function HomeHeroSection({ translations: t }: HomeHeroSectionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger mount animation on next frame for smooth paint
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Progressive enhancement: SSR / hydrate 初期は style 無し (= visible) で、
  // JS hydrate 後にのみ animation を適用する。JS が動かなくても Hero 本体
  // (title / CTA / search / seller link) は即座に見える。
  // CSS keyframe の `from { opacity: 0 } to { opacity: 1 }` により、mounted 後
  // animation 開始時に一瞬 opacity 0 になるが forwards で visible に落ち着く。
  const entrance = (delay: number, animation = "hero-title-reveal") => {
    if (!mounted) return undefined;
    return {
      animation: `${animation} 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms forwards`,
    };
  };

  return (
    <section className="relative overflow-hidden rounded-sm py-20 text-center sm:py-24" data-animate>
      {/* Atmospheric background with glow pulse */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,197,66,0.08),transparent_60%)]"
        style={mounted ? { animation: "hero-glow-pulse 4s ease-in-out infinite" } : {}}
        data-animate
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(64,192,224,0.05),transparent_50%)]" />

      {/* Floating particles — HeroParticles handles reduced-motion internally */}
      {mounted && <HeroParticles />}

      <div className="relative">
        {/* Eco badges — stagger drop-in */}
        <div className="mb-6 flex flex-wrap justify-center gap-2 sm:gap-3">
          {BADGES.map((badge, i) => (
            <span
              key={badge.label}
              className={`dq-window-sm px-3 py-1 text-xs font-medium ${badge.color}`}
              style={entrance(100 + i * 100, "hero-badge-drop")}
              data-animate
            >
              {badge.label}
            </span>
          ))}
        </div>

        {/* Title — blur-to-sharp reveal */}
        <h1
          className="font-display text-5xl font-bold leading-tight tracking-wide text-dq-gold text-glow-gold sm:text-7xl"
          style={entrance(300)}
          data-animate
        >
          Know<span className="tracking-normal">Mint</span>
        </h1>

        {/* Catchphrase — fade-up */}
        <p
          className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-dq-text-sub sm:text-xl"
          style={entrance(500, "animate-fade-up")}
          data-animate
        >
          {t.heroCatchphrase}
        </p>
        <p
          className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-dq-text-muted"
          style={entrance(600, "animate-fade-up")}
          data-animate
        >
          {t.heroTagline}
        </p>

        {/* CTAs — stagger fade-up */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/search"
            className="rounded-sm bg-dq-gold px-9 py-4 text-sm font-bold text-dq-bg shadow-[0_0_30px_rgba(245,197,66,0.3)] motion-safe:transition-all hover:brightness-110 hover:shadow-[0_0_40px_rgba(245,197,66,0.4)]"
            style={entrance(700, "animate-fade-up")}
            data-animate
          >
            {t.exploreMarket}
          </Link>
          <Link
            href="#how-it-works"
            className="rounded-sm border-2 border-dq-cyan/50 px-9 py-4 text-sm font-semibold text-dq-cyan motion-safe:transition-all hover:border-dq-cyan hover:bg-dq-cyan/5"
            style={entrance(800, "animate-fade-up")}
            data-animate
          >
            {t.heroSubCtaLabel}
          </Link>
        </div>

        {/* Hero Search — fade-up */}
        <div
          className="mx-auto mt-10 max-w-lg"
          style={entrance(900, "animate-fade-up")}
          data-animate
        >
          <SearchBar className="w-full" />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SEARCH_TAGS.map((tag) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}`}
                className="rounded-sm border border-dq-border bg-dq-surface/50 px-3 py-1 text-xs text-dq-text-muted transition-colors hover:border-dq-gold/40 hover:text-dq-gold"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>

        {/* Seller CTA */}
        <p
          className="mt-4 text-center text-sm text-dq-text-muted"
          style={entrance(1000, "animate-fade-in")}
          data-animate
        >
          {t.heroSellerCta}{" "}
          <Link
            href="/list"
            className="font-semibold text-dq-cyan transition-colors hover:text-dq-gold"
          >
            {t.heroSellerCtaLink}
          </Link>
        </p>
      </div>
    </section>
  );
}
