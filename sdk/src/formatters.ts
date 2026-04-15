/**
 * Shared formatters for KnowMint search results and related display helpers.
 *
 * Historically MCP / AgentKit / Eliza each owned their own copy with subtle
 * differences (Japanese vs English labels, sanitize vs no-sanitize, score
 * presence). Consolidating here avoids drift and gives callers one knob set.
 */

export interface SearchResultsItem {
  id?: string;
  title?: string;
  usefulness_score?: number | null;
  tags?: readonly unknown[];
  price_sol?: number | null;
  price_usdc?: number | null;
  metadata?: {
    domain?: string | null;
    experience_type?: string | null;
    source_type?: string | null;
    applicable_to?: readonly unknown[] | null;
  } | null;
  seller?: {
    trust_score?: number | null;
  } | null;
}

export interface SearchResultsPayload {
  data: readonly unknown[];
  pagination?: unknown;
}

/** Available display locales. */
export type SearchResultsLocale = "en" | "ja";

export interface FormatSearchResultsOptions {
  /** Label language. Defaults to "en". */
  locale?: SearchResultsLocale;
  /** When true, strip control characters and newlines from untrusted fields. */
  sanitize?: boolean;
  /** When true, render price alongside the title. Defaults to false. */
  showPrice?: boolean;
}

/** Strip ASCII control chars (incl. newlines) and truncate for log safety. */
function sanitizeField(raw: unknown, maxLen = 256): string {
  const str = typeof raw === "string" ? raw : String(raw ?? "");
  // eslint-disable-next-line no-control-regex
  const cleaned = str.replace(/[\x00-\x1f\x7f]/g, "");
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function identity(raw: unknown): string {
  return typeof raw === "string" ? raw : String(raw ?? "");
}

/** Pricing suffix used when `showPrice` is enabled. */
function formatPrice(item: SearchResultsItem): string {
  if (typeof item.price_sol === "number" && Number.isFinite(item.price_sol)) {
    return `${item.price_sol} SOL`;
  }
  if (typeof item.price_usdc === "number" && Number.isFinite(item.price_usdc)) {
    return `${item.price_usdc} USDC`;
  }
  return "N/A";
}

interface Labels {
  quality: string;
  trust: string;
  tags: string;
  metadata: string;
  domain: string;
  experienceType: string;
  sourceType: string;
  applicableTo: string;
  summary(total: number): string;
}

const LABELS: Record<SearchResultsLocale, Labels> = {
  en: {
    quality: "Quality",
    trust: "Trust",
    tags: "Tags",
    metadata: "Metadata",
    domain: "domain",
    experienceType: "type",
    sourceType: "source",
    applicableTo: "ai",
    summary: (total) => `${total} result${total === 1 ? "" : "s"}`,
  },
  ja: {
    quality: "品質スコア",
    trust: "信頼度",
    tags: "タグ",
    metadata: "メタデータ",
    domain: "ドメイン",
    experienceType: "経験タイプ",
    sourceType: "ソース",
    applicableTo: "対応AI",
    summary: (total) => `${total}件の結果`,
  },
};

/**
 * Render a paginated search response into a human-readable text block.
 *
 * Example (en, sanitize=true):
 * ```
 * 2 results
 * [Quality: 0.84] [Trust: 0.92] How to ship on Solana (id: abc)
 *   Tags: #solana #rust
 *   Metadata: domain=engineering, type=how_to
 * ```
 */
export function formatSearchResults(
  result: SearchResultsPayload,
  options: FormatSearchResultsOptions = {}
): string {
  const locale = options.locale ?? "en";
  const labels = LABELS[locale];
  const clean = options.sanitize ? sanitizeField : identity;

  const items = result.data as readonly SearchResultsItem[];
  const lines: string[] = [];

  for (const item of items) {
    const score =
      typeof item.usefulness_score === "number" && Number.isFinite(item.usefulness_score)
        ? `[${labels.quality}: ${item.usefulness_score.toFixed(2)}] `
        : "";
    const trust =
      typeof item.seller?.trust_score === "number" && Number.isFinite(item.seller.trust_score)
        ? `[${labels.trust}: ${item.seller.trust_score.toFixed(2)}] `
        : "";

    const title = clean(item.title ?? (locale === "ja" ? "(タイトルなし)" : "(no title)"));
    const id = clean(item.id ?? "?");
    const priceSuffix = options.showPrice ? ` (${formatPrice(item)})` : "";

    lines.push(`${score}${trust}${title}${priceSuffix} (id: ${id})`);

    if (Array.isArray(item.tags) && item.tags.length > 0) {
      const rendered = item.tags.map((t) => `#${clean(t)}`).join(" ");
      lines.push(`  ${labels.tags}: ${rendered}`);
    }

    const metadata = item.metadata;
    if (metadata && typeof metadata === "object") {
      const parts: string[] = [];
      if (metadata.domain) parts.push(`${labels.domain}=${clean(metadata.domain)}`);
      if (metadata.experience_type) {
        parts.push(`${labels.experienceType}=${clean(metadata.experience_type)}`);
      }
      if (metadata.source_type) {
        parts.push(`${labels.sourceType}=${clean(metadata.source_type)}`);
      }
      if (Array.isArray(metadata.applicable_to) && metadata.applicable_to.length > 0) {
        const joined = metadata.applicable_to.map((v) => clean(v)).join(",");
        parts.push(`${labels.applicableTo}=${joined}`);
      }
      if (parts.length > 0) {
        lines.push(`  ${labels.metadata}: ${parts.join(", ")}`);
      }
    }
  }

  const summary = labels.summary(items.length);
  return lines.length > 0 ? `${summary}\n${lines.join("\n")}` : summary;
}
