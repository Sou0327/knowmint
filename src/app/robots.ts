import type { MetadataRoute } from "next";

const PROTECTED_PATHS = ["/dashboard", "/profile", "/api", "/list", "/library", "/favorites", "/notifications"];
const LOCALES = ["ja"];

const disallowList = [
  ...PROTECTED_PATHS,
  ...LOCALES.flatMap((l) => PROTECTED_PATHS.map((p) => `/${l}${p}`)),
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: disallowList,
      },
      {
        userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Amazonbot", "CCBot", "Applebot-Extended", "OAI-SearchBot", "ChatGPT-User", "bingbot"],
        allow: "/",
        disallow: disallowList,
      },
    ],
    sitemap: "https://knowmint.shop/sitemap.xml",
  };
}
