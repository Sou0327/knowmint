import { getTranslations } from "next-intl/server";
import { getAdminTransactions } from "@/lib/admin/queries";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminTable from "@/components/admin/AdminTable";
import AdminPagination from "@/components/admin/AdminPagination";
import Badge from "@/components/ui/Badge";

interface AdminTransactionsPageProps {
  searchParams: Promise<{
    status?: string;
    chain?: string;
    token?: string;
    page?: string;
  }>;
}

function getStatusVariant(
  status: string
): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "confirmed":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "error";
    case "refunded":
      return "info";
    default:
      return "default";
  }
}

export default async function AdminTransactionsPage({
  searchParams,
}: AdminTransactionsPageProps) {
  // Admin guard is enforced by (admin)/layout.tsx
  const [t, params] = await Promise.all([
    getTranslations("Admin"),
    searchParams,
  ]);

  const pageStr = params.page ?? "1";
  const page = /^[1-9]\d*$/.test(pageStr) ? Number(pageStr) : 1;
  const { data, total, per_page } = await getAdminTransactions({
    status: params.status,
    chain: params.chain,
    token: params.token,
    page,
  });

  const totalPages = Math.ceil(total / per_page);

  const headers = [
    { key: "item", label: t("item") },
    { key: "buyer", label: t("buyer") },
    { key: "seller", label: t("seller") },
    { key: "amount", label: t("amount") },
    { key: "token", label: t("token") },
    { key: "chain", label: t("chain") },
    { key: "status", label: t("status") },
    { key: "tx_hash", label: t("txHash") },
    { key: "created", label: t("created") },
  ];

  const currentSearchParams: Record<string, string> = {};
  if (params.status) currentSearchParams.status = params.status;
  if (params.chain) currentSearchParams.chain = params.chain;
  if (params.token) currentSearchParams.token = params.token;

  const statusFilters = [
    { value: "all", label: t("all") },
    { value: "pending", label: t("pending") },
    { value: "confirmed", label: t("confirmed") },
    { value: "failed", label: t("failed") },
    { value: "refunded", label: t("refunded") },
  ];

  const chainFilters = [
    { value: "all", label: t("all") },
    { value: "solana", label: "Solana" },
    { value: "base", label: "Base" },
    { value: "ethereum", label: "Ethereum" },
    { value: "tempo", label: "Tempo" },
  ];

  const tokenFilters = [
    { value: "all", label: t("all") },
    { value: "SOL", label: "SOL" },
    { value: "USDC", label: "USDC" },
    { value: "ETH", label: "ETH" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dq-gold">
        {t("transactions")}
      </h1>

      <AdminFilters
        filters={[
          {
            name: "status",
            label: t("status"),
            options: statusFilters,
          },
          {
            name: "chain",
            label: t("chain"),
            options: chainFilters,
          },
          {
            name: "token",
            label: t("token"),
            options: tokenFilters,
          },
        ]}
      />

      <AdminTable
        headers={headers}
        isEmpty={data.length === 0}
        emptyMessage={t("noTransactions")}
      >
        {data.map((tx) => (
          <tr key={tx.id} className="hover:bg-dq-surface">
            {/* Item */}
            <td className="px-4 py-3">
              <span className="text-dq-text text-sm line-clamp-1 max-w-[160px] block">
                {tx.knowledge_item?.title ?? "—"}
              </span>
            </td>

            {/* Buyer */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">
                {tx.buyer?.display_name ?? t("anonymous")}
              </span>
            </td>

            {/* Seller */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">
                {tx.seller?.display_name ?? t("anonymous")}
              </span>
            </td>

            {/* Amount */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">
                {Number(tx.amount).toFixed(4)}
              </span>
            </td>

            {/* Token */}
            <td className="px-4 py-3">
              <Badge variant="default">{tx.token}</Badge>
            </td>

            {/* Chain */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">{tx.chain}</span>
            </td>

            {/* Status */}
            <td className="px-4 py-3">
              <Badge variant={getStatusVariant(tx.status)}>{tx.status}</Badge>
            </td>

            {/* TX Hash */}
            <td className="px-4 py-3">
              {tx.tx_hash ? (
                <span className="font-mono text-xs text-dq-text-sub">
                  {tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-4)}
                </span>
              ) : (
                <span className="text-dq-text-muted text-xs">—</span>
              )}
            </td>

            {/* Created */}
            <td className="px-4 py-3">
              <span className="text-dq-text-muted text-xs">
                {new Date(tx.created_at).toLocaleDateString()}
              </span>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/admin/transactions"
        searchParams={currentSearchParams}
      />
    </div>
  );
}
