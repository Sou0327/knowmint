const BASE_URL = "https://knowmint.shop";

/** Shared OG fields to spread into page-level openGraph (prevents parent override loss) */
export function ogDefaults(locale: string = "en") {
  return {
    siteName: "KnowMint",
    locale: locale === "ja" ? "ja_JP" : "en_US",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "KnowMint" }],
  };
}

export function buildAlternates(path: string, locale: string = "en") {
  const canonicalPrefix = locale === "en" ? "" : `/${locale}`;
  // "/" のときは prefix のみ (trailing slash 回避)
  const normalizedPath = path === "/" ? "" : path;
  return {
    canonical: normalizedPath ? `${canonicalPrefix}${normalizedPath}` : (canonicalPrefix || "/"),
    languages: {
      en: `${BASE_URL}${normalizedPath || "/"}`,
      ja: `${BASE_URL}/ja${normalizedPath}`,
      "x-default": `${BASE_URL}${normalizedPath || "/"}`,
    },
  };
}
