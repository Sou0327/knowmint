import { getTranslations, getLocale } from "next-intl/server";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [t, { locale }] = await Promise.all([
    getTranslations("Developers"),
    params,
  ]);
  return {
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates("/developers", locale),
    openGraph: { ...ogDefaults(locale), title: t("ogTitle"), type: "website" },
  };
}

const MCP_CONFIG = `{
  "mcpServers": {
    "knowmint": {
      "command": "npx",
      "args": [
        "--yes",
        "--package",
        "@knowmint/mcp-server@latest",
        "mcp-server"
      ],
      "env": {
        "KM_API_KEY": "km_xxx",
        "KM_BASE_URL": "https://knowmint.shop"
      }
    }
  }
}`;

const MCP_TOOLS = [
  { name: "km_search", desc: "searchDesc" },
  { name: "km_get_detail", desc: "getDetailDesc" },
  { name: "km_purchase", desc: "purchaseDesc" },
  { name: "km_get_content", desc: "getContentDesc" },
  { name: "km_publish", desc: "publishDesc" },
] as const;

const CLI_COMMANDS = [
  { cmd: "km search 'prompt engineering'", desc: "cliSearchDesc" },
  { cmd: "km install <item-id>", desc: "cliInstallDesc" },
  { cmd: "km publish prompt <file> --price 0.1SOL", desc: "cliPublishDesc" },
  { cmd: "km my purchases", desc: "cliMyPurchasesDesc" },
] as const;

const API_ENDPOINTS = [
  { method: "GET", path: "/api/v1/knowledge", desc: "apiListDesc" },
  { method: "GET", path: "/api/v1/knowledge/{id}", desc: "apiDetailDesc" },
  { method: "GET", path: "/api/v1/knowledge/{id}/content", desc: "apiContentDesc" },
  { method: "POST", path: "/api/v1/knowledge", desc: "apiCreateDesc" },
  { method: "POST", path: "/api/v1/knowledge/batch", desc: "apiBatchDesc" },
] as const;

export default async function DevelopersPage() {
  const [t, locale] = await Promise.all([
    getTranslations("Developers"),
    getLocale(),
  ]);
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "@knowmint/mcp-server",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Cross-platform (Node.js 22.6+)",
        url: `https://knowmint.shop${localePrefix}/developers`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        author: { "@type": "Organization", "@id": "https://knowmint.shop/#organization", name: "KnowMint" },
      }} />

      {/* Hero */}
      <h1 className="mb-4 text-3xl font-bold font-display text-dq-gold">
        {t("title")}
      </h1>
      <p className="mb-12 text-lg text-dq-text-sub">
        {t("heroDesc")}
      </p>

      {/* MCP Server */}
      <section className="mb-12">
        <h2 className="mb-4 border-l-4 border-dq-gold pl-3 text-xl font-bold font-display text-dq-gold">
          {t("mcpTitle")}
        </h2>
        <p className="mb-4 text-dq-text-sub">{t("mcpDesc")}</p>
        <p className="mb-6 leading-relaxed text-dq-text-sub">{t("mcpProse")}</p>
        <div className="mb-6 overflow-x-auto rounded-sm dq-window p-4">
          <pre className="text-sm text-dq-cyan"><code>{MCP_CONFIG}</code></pre>
        </div>
        <h3 className="mb-3 text-lg font-semibold text-dq-text">
          {t("mcpToolsTitle")}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dq-border text-left text-dq-text-muted">
                <th className="pb-2 pr-4">{t("toolName")}</th>
                <th className="pb-2">{t("toolDescription")}</th>
              </tr>
            </thead>
            <tbody className="text-dq-text-sub">
              {MCP_TOOLS.map((tool) => (
                <tr key={tool.name} className="border-b border-dq-border/50">
                  <td className="py-2 pr-4 font-mono text-dq-cyan">{tool.name}</td>
                  <td className="py-2">{t(tool.desc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CLI */}
      <section className="mb-12">
        <h2 className="mb-4 border-l-4 border-dq-gold pl-3 text-xl font-bold font-display text-dq-gold">
          {t("cliTitle")}
        </h2>
        <p className="mb-4 text-dq-text-sub">{t("cliDesc")}</p>
        <p className="mb-6 leading-relaxed text-dq-text-sub">{t("cliProse")}</p>
        <div className="mb-4 overflow-x-auto rounded-sm dq-window p-4">
          <pre className="text-sm text-dq-cyan"><code>npm run km -- &lt;command&gt;</code></pre>
        </div>
        <div className="space-y-2">
          {CLI_COMMANDS.map((c) => (
            <div key={c.cmd} className="flex gap-4 rounded-sm dq-window-sm p-3">
              <code className="shrink-0 text-sm text-dq-cyan">{c.cmd}</code>
              <span className="text-sm text-dq-text-sub">{t(c.desc)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* REST API */}
      <section className="mb-12">
        <h2 className="mb-4 border-l-4 border-dq-gold pl-3 text-xl font-bold font-display text-dq-gold">
          {t("apiTitle")}
        </h2>
        <p className="mb-4 text-dq-text-sub">{t("apiDesc")}</p>
        <p className="mb-6 leading-relaxed text-dq-text-sub">{t("apiProse")}</p>
        <p className="mb-4 text-sm text-dq-text-muted">
          {t("apiBaseUrl")}: <code className="text-dq-cyan">https://knowmint.shop/api/v1</code>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dq-border text-left text-dq-text-muted">
                <th className="pb-2 pr-4">{t("apiMethod")}</th>
                <th className="pb-2 pr-4">{t("apiPath")}</th>
                <th className="pb-2">{t("toolDescription")}</th>
              </tr>
            </thead>
            <tbody className="text-dq-text-sub">
              {API_ENDPOINTS.map((ep) => (
                <tr key={ep.path + ep.method} className="border-b border-dq-border/50">
                  <td className="py-2 pr-4 font-mono font-bold text-dq-gold">{ep.method}</td>
                  <td className="py-2 pr-4 font-mono text-dq-cyan">{ep.path}</td>
                  <td className="py-2">{t(ep.desc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-dq-text-muted">
          {t("apiAuthNote")}
        </p>
      </section>

      {/* SDKs */}
      <section className="mb-12">
        <h2 className="mb-4 border-l-4 border-dq-gold pl-3 text-xl font-bold font-display text-dq-gold">
          {t("sdkTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-sm dq-window p-6">
            <h3 className="mb-2 text-lg font-semibold text-dq-text">ElizaOS</h3>
            <p className="mb-3 text-sm text-dq-text-sub">{t("elizaDesc")}</p>
            <code className="text-sm text-dq-cyan">@knowledge-market/eliza-plugin</code>
          </div>
          <div className="rounded-sm dq-window p-6">
            <h3 className="mb-2 text-lg font-semibold text-dq-text">Coinbase AgentKit</h3>
            <p className="mb-3 text-sm text-dq-text-sub">{t("agentKitDesc")}</p>
            <code className="text-sm text-dq-cyan">@knowledge-market/agentkit-plugin</code>
          </div>
        </div>
      </section>
    </div>
  );
}
