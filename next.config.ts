import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // @vercel/og (resvg.wasm + yoga.wasm) を空スタブに差し替えてバンドルサイズを削減
  // Cloudflare Workers free 上限 3 MiB (gzip) に収めるため
  turbopack: {
    resolveAlias: {
      "next/dist/compiled/@vercel/og/index.edge.js": "./src/lib/og-stub",
    },
  },

  async headers() {
    return [
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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.solana.com https://api.mainnet-beta.solana.com${isDev ? " http://127.0.0.1:54321 ws://127.0.0.1:54321" : ""}`,
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
