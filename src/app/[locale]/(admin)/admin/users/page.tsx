import { getTranslations } from "next-intl/server";
import { getAdminUsers } from "@/lib/admin/queries";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminTable from "@/components/admin/AdminTable";
import AdminPagination from "@/components/admin/AdminPagination";
import UserBanActions from "@/components/admin/UserBanActions";
import Badge from "@/components/ui/Badge";

interface AdminUsersPageProps {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  // Admin guard is enforced by (admin)/layout.tsx
  const [t, params] = await Promise.all([
    getTranslations("Admin"),
    searchParams,
  ]);

  const pageStr = params.page ?? "1";
  const page = /^[1-9]\d*$/.test(pageStr) ? Number(pageStr) : 1;
  const { data, total, per_page } = await getAdminUsers({
    search: params.search,
    page,
  });

  const totalPages = Math.ceil(total / per_page);

  const headers = [
    { key: "name", label: t("name") },
    { key: "type", label: t("type") },
    { key: "wallet", label: t("wallet") },
    { key: "trust_score", label: t("trustScore") },
    { key: "status", label: t("status") },
    { key: "created", label: t("created") },
    { key: "actions", label: t("actions") },
  ];

  const currentSearchParams: Record<string, string> = {};
  if (params.search) currentSearchParams.search = params.search;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dq-gold">
        {t("users")}
      </h1>

      <AdminSearchBar placeholder={t("searchUsers")} />

      <AdminTable
        headers={headers}
        isEmpty={data.length === 0}
        emptyMessage={t("noUsers")}
        totalCount={total}
      >
        {data.map((user) => {
          const isBanned = user.banned_at !== null;
          return (
            <tr
              key={user.id}
              className={`hover:bg-dq-surface${isBanned ? " opacity-60" : ""}`}
            >
              {/* Name */}
              <td className="px-4 py-3">
                <span className="text-dq-text">
                  {user.display_name ?? t("anonymous")}
                </span>
              </td>

              {/* Type */}
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="default">{user.user_type}</Badge>
                  {user.is_admin && (
                    <Badge variant="info">{t("admin")}</Badge>
                  )}
                </div>
              </td>

              {/* Wallet */}
              <td className="px-4 py-3">
                {user.wallet_address ? (
                  <span className="font-mono text-xs text-dq-text-sub">
                    {user.wallet_address.slice(0, 6)}...
                    {user.wallet_address.slice(-4)}
                  </span>
                ) : (
                  <span className="text-dq-text-muted text-xs">—</span>
                )}
              </td>

              {/* Trust Score */}
              <td className="px-4 py-3">
                <span className="text-dq-text-sub">
                  {user.trust_score !== null
                    ? user.trust_score.toFixed(1)
                    : "—"}
                </span>
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                {isBanned ? (
                  <Badge variant="error">{t("banned")}</Badge>
                ) : (
                  <Badge variant="success">{t("active")}</Badge>
                )}
              </td>

              {/* Created */}
              <td className="px-4 py-3">
                <span className="text-dq-text-muted text-xs">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <UserBanActions
                  userId={user.id}
                  isBanned={isBanned}
                  isAdmin={user.is_admin}
                />
              </td>
            </tr>
          );
        })}
      </AdminTable>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/admin/users"
        searchParams={currentSearchParams}
      />
    </div>
  );
}
