import { getTranslations } from "next-intl/server";
import { getAdminApiKeys } from "@/lib/admin/queries";
import AdminTable from "@/components/admin/AdminTable";
import AdminPagination from "@/components/admin/AdminPagination";
import ApiKeyActions from "@/components/admin/ApiKeyActions";
import Badge from "@/components/ui/Badge";

interface AdminApiKeysPageProps {
  searchParams: Promise<{ page?: string }>;
}

function getPermissionVariant(
  perm: string
): "error" | "warning" | "info" | "default" {
  switch (perm) {
    case "admin":
      return "error";
    case "write":
      return "warning";
    case "read":
      return "info";
    default:
      return "default";
  }
}

export default async function AdminApiKeysPage({
  searchParams,
}: AdminApiKeysPageProps) {
  // Admin guard is enforced by (admin)/layout.tsx
  const [t, params] = await Promise.all([
    getTranslations("Admin"),
    searchParams,
  ]);

  const pageStr = params.page ?? "1";
  const page = /^[1-9]\d*$/.test(pageStr) ? Number(pageStr) : 1;
  const { data, total, per_page } = await getAdminApiKeys({ page });

  const totalPages = Math.ceil(total / per_page);

  const headers = [
    { key: "owner", label: t("owner") },
    { key: "name", label: t("name") },
    { key: "permissions", label: t("permissions") },
    { key: "last_used", label: t("lastUsed") },
    { key: "created", label: t("created") },
    { key: "expires", label: t("expires") },
    { key: "actions", label: t("actions") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dq-gold">
        {t("apiKeys")}
      </h1>

      <AdminTable
        headers={headers}
        isEmpty={data.length === 0}
        emptyMessage={t("noApiKeys")}
      >
        {data.map((key) => (
          <tr key={key.id} className="hover:bg-dq-surface">
            {/* Owner */}
            <td className="px-4 py-3">
              <span className="text-dq-text-sub text-sm">
                {key.user?.display_name ?? t("anonymous")}
              </span>
            </td>

            {/* Name */}
            <td className="px-4 py-3">
              <span className="text-dq-text text-sm">{key.name}</span>
            </td>

            {/* Permissions */}
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1">
                {key.permissions.map((perm) => (
                  <Badge key={perm} variant={getPermissionVariant(perm)}>
                    {perm}
                  </Badge>
                ))}
              </div>
            </td>

            {/* Last Used */}
            <td className="px-4 py-3">
              <span className="text-dq-text-muted text-xs">
                {key.last_used_at
                  ? new Date(key.last_used_at).toLocaleDateString()
                  : t("never")}
              </span>
            </td>

            {/* Created */}
            <td className="px-4 py-3">
              <span className="text-dq-text-muted text-xs">
                {new Date(key.created_at).toLocaleDateString()}
              </span>
            </td>

            {/* Expires */}
            <td className="px-4 py-3">
              <span className="text-dq-text-muted text-xs">
                {key.expires_at
                  ? new Date(key.expires_at).toLocaleDateString()
                  : t("noExpiry")}
              </span>
            </td>

            {/* Actions */}
            <td className="px-4 py-3">
              <ApiKeyActions keyId={key.id} />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/admin/api-keys"
      />
    </div>
  );
}
