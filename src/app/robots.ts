import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/profile/", "/api/", "/list/", "/library/"],
    },
    sitemap: "https://knowmint.shop/sitemap.xml",
  };
}
