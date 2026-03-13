import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // @vercel/og (resvg.wasm + yoga.wasm) を空スタブに差し替えてバンドルサイズを削減
  // Cloudflare Workers free 上限 3 MiB (gzip) に収めるため
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      "next/dist/compiled/@vercel/og/index.edge.js": "./src/lib/og-stub",
    },
  },

  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // s-maxage removed: nonce-based CSP requires per-request nonce;
      // shared CDN cache would reuse stale nonces, weakening CSP
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
