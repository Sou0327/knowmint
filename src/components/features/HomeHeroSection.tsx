// F-9: Home page 分割 — Hero セクション
import { Link } from "@/i18n/navigation";
import SearchBar from "@/components/features/SearchBar";
import type { useTranslations } from "next-intl";

type Translations = ReturnType<typeof useTranslations<"Home">>;

interface HomeHeroSectionProps {
  tHome: Translations;
}

export function HomeHeroSection({ tHome }: HomeHeroSectionProps) {
  return (
    <section className="relative overflow-hidden rounded-sm py-20 text-center sm:py-24">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,197,66,0.08),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(64,192,224,0.05),transparent_50%)]" />

      <div className="relative">
        {/* Eco badges */}
        <div className="mb-6 flex flex-wrap justify-center gap-2 sm:gap-3">
          <span className="dq-window-sm px-3 py-1 text-xs font-medium text-dq-cyan">
            x402 Protocol
          </span>
          <span className="self-center text-dq-text-muted" aria-hidden="true">·</span>
          <span className="dq-window-sm px-3 py-1 text-xs font-medium text-dq-gold">
            Solana
          </span>
          <span className="self-center text-dq-text-muted" aria-hidden="true">·</span>
          <span className="dq-window-sm px-3 py-1 text-xs font-medium text-dq-text-sub">
            MCP
          </span>
        </div>

        <h1 className="font-display text-5xl font-bold leading-tight tracking-wide text-dq-gold text-glow-gold sm:text-7xl">
          Know<span className="tracking-normal">Mint</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-dq-text-sub sm:text-xl">
          {tHome("heroCatchphrase")}
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-dq-text-muted">
          {tHome("heroTagline")}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/search"
            className="rounded-sm bg-dq-gold px-9 py-4 text-sm font-bold text-dq-bg shadow-[0_0_30px_rgba(245,197,66,0.3)] motion-safe:transition-all hover:brightness-110 hover:shadow-[0_0_40px_rgba(245,197,66,0.4)]"
          >
            {tHome("exploreMarket")}
          </Link>
          <Link
            href="#how-it-works"
            className="rounded-sm border-2 border-dq-cyan/50 px-9 py-4 text-sm font-semibold text-dq-cyan motion-safe:transition-all hover:border-dq-cyan hover:bg-dq-cyan/5"
          >
            {tHome("heroSubCtaLabel")}
          </Link>
        </div>

        {/* Hero Search */}
        <div className="mx-auto mt-10 max-w-lg">
          <SearchBar className="w-full" />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {["MCP", "prompt", "Claude Code", "dataset", "Solana"].map((tag) => (
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
        <p className="mt-4 text-center text-sm text-dq-text-muted">
          {tHome("heroSellerCta")}{" "}
          <Link
            href="/list"
            className="font-semibold text-dq-cyan transition-colors hover:text-dq-gold"
          >
            {tHome("heroSellerCtaLink")}
          </Link>
        </p>
      </div>
    </section>
  );
}
