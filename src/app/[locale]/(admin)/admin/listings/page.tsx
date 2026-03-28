import { getTranslations } from "next-intl/server";
import { getAdminListings } from "@/lib/admin/queries";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminTable from "@/components/admin/AdminTable";
import AdminPagination from "@/components/admin/AdminPagination";
import ListingActions from "@/components/admin/ListingActions";
import Badge from "@/components/ui/Badge";

interface AdminListingsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    content_type?: string;
    page?: string;
  }>;
}

function getStatusVariant(
  status: string
): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "published":
      return "success";
    case "draft":
      return "warning";
    case "archived":
      return "default";
    case "suspended":
      return "error";
    default:
      return "default";
  }
}

export default async function AdminListingsPage({
  searchParams,
}: AdminListingsPageProps) {
  // Admin guard is enforced by (admin)/layout.tsx
  const [t, params] = await Promise.all([
    getTranslations("Admin"),
    searchParams,
  ]);

  const pageStr = params.page ?? "1";
  const page = /^[1-9]\d*$/.test(pageStr) ? Number(pageStr) : 1;
  const { data, total, per_page } = await getAdminListings({
    search: params.search,
    status: params.status,
    content_type: params.content_type,
    page,
  });

  const totalPages = Math.ceil(total / per_page);

  const headers = [
    { key: "title", label: t("title") },
    { key: "seller", label: t("seller") },
    { key: "type", label: t("type") },
    { key: "status", label: t("status") },
    { key: "price", label: t("price") },
    { key: "views", label: t("views") },
    { key: "sales", label: t("sales") },
    { key: "created", label: t("created") },
    { key: "actions", label: t("actions") },
  ];

  const currentSearchParams: Record<string, string> = {};
  if (params.search) currentSearchParams.search = params.search;
  if (params.status) currentSearchParams.status = params.status;
  if (params.content_type) currentSearchParams.content_type = params.content_type;

  const statusFilters = [
    { value: "all", label: t("all") },
    { value: "draft", label: t("draft") },
    { value: "published", label: t("published") },
    { value: "archived", label: t("archived") },
    { value: "suspended", label: t("suspended") },
  ];

  const contentTypeFilters = [
    { value: "all", label: t("all") },
    { value: "prompt", label: "Prompt" },
    { value: "tool_def", label: "Tool Def" },
    { value: "dataset", label: "Dataset" },
    { value: "api", label: "API" },
    { value: "general", label: "General" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dq-gold">
        {t("listings")}
      </h1>

      <div className="space-y-3">
        <AdminSearchBar placeholder={t("searchListings")} />
        <AdminFilters
          filters={[
            {
              name: "status",
              label: t("status"),
              options: statusFilters,
            },
            {
              name: "content_type",
              label: t("type"),
              options: contentTypeFilters,
            },
          ]}
        />
      </div>

      <AdminTable
        headers={headers}
        isEmpty={data.length === 0}
        emptyMessage={t("noListings")}
      >
        {data.map((item) => (
          <tr key={item.id} className="hover:bg-dq-surface">
            {/* Title */}
            <td className="px-4 py-3">
              <span className="text-dq-text line-clamp-1 max-w-[200px] block">
                {item.title}
              </span>
            </td>

            {/* Seller */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">
                {item.seller?.display_name ?? t("anonymous")}
              </span>
            </td>

            {/* Type */}
            <td className="px-4 py-3">
              <Badge variant="info">{item.content_type}</Badge>
            </td>

            {/* Status */}
            <td className="px-4 py-3">
              <Badge variant={getStatusVariant(item.status)}>
                {item.status}
              </Badge>
            </td>

            {/* Price */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">
                {item.price_sol != null
                  ? `${item.price_sol} SOL`
                  : item.price_usdc != null
                    ? `${item.price_usdc} USDC`
                    : "—"}
              </span>
            </td>

            {/* Views */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">{item.view_count}</span>
            </td>

            {/* Sales */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">
                {item.purchase_count}
              </span>
            </td>

            {/* Created */}
            <td className="px-4 py-3">
              <span className="text-dq-text-muted text-xs">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </td>

            {/* Actions */}
            <td className="px-4 py-3">
              <ListingActions
                itemId={item.id}
                currentStatus={item.status}
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/admin/listings"
        searchParams={currentSearchParams}
      />
    </div>
  );
}
