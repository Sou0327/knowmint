import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAdminReports } from "@/lib/admin/queries";
import AdminTable from "@/components/admin/AdminTable";
import AdminPagination from "@/components/admin/AdminPagination";
import Badge, { type BadgeProps } from "@/components/ui/Badge";
import ReportReviewActions from "@/components/admin/ReportReviewActions";

const VALID_STATUSES = ["pending", "reviewing", "resolved", "dismissed"] as const;
type ReportStatus = typeof VALID_STATUSES[number];
type TabKey = "all" | ReportStatus;

const STATUS_TABS: TabKey[] = ["all", "pending", "reviewing", "resolved", "dismissed"];

function reasonBadgeVariant(reason: string): BadgeProps["variant"] {
  if (reason === "spam" || reason === "illegal") return "error";
  if (reason === "misleading") return "warning";
  return "default";
}

function statusBadgeVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "resolved":  return "success";
    case "reviewing": return "warning";
    case "pending":   return "error";
    case "dismissed": return "default";
    default:          return "default";
  }
}

interface ReportsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  // Admin guard is enforced by (admin)/layout.tsx
  const params = await searchParams;
  const statusParam = params.status;
  const activeTab: TabKey =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as ReportStatus)
      : "all";
  const pageStr = params.page ?? "1";
  const page = /^[1-9]\d*$/.test(pageStr) ? Number(pageStr) : 1;
  const perPage = 20;

  const [t, result] = await Promise.all([
    getTranslations("Admin"),
    getAdminReports({
      status: activeTab === "all" ? undefined : activeTab,
      page,
      per_page: perPage,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / perPage));

  const headers = [
    { key: "reason",   label: t("reason") },
    { key: "item",     label: t("item") },
    { key: "reporter", label: t("reporter") },
    { key: "status",   label: t("status") },
    { key: "created",  label: t("createdAt") },
    { key: "actions",  label: t("actions"), className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dq-gold">
        {t("reports")}
      </h1>

      {/* Status filter tabs */}
      <nav className="flex gap-1 border-b border-dq-border mb-6" aria-label="Report status filter">
        {STATUS_TABS.map((tab) => {
          const href =
            tab === "all"
              ? "/admin/reports"
              : `/admin/reports?status=${tab}`;
          const isActive = tab === activeTab;
          return (
            <Link
              key={tab}
              href={href}
              className={
                isActive
                  ? "px-4 py-2 text-sm font-medium border-b-2 border-dq-gold text-dq-gold -mb-px"
                  : "px-4 py-2 text-sm font-medium text-dq-text-muted hover:text-dq-text-sub transition-colors"
              }
            >
              {t(tab as Parameters<typeof t>[0])}
            </Link>
          );
        })}
      </nav>

      <AdminTable
        headers={headers}
        isEmpty={result.data.length === 0}
        emptyMessage={t("noReports")}
      >
        {result.data.map((report) => (
          <tr key={report.id} className="hover:bg-dq-surface transition-colors">
            {/* Reason */}
            <td className="px-4 py-3">
              <Badge variant={reasonBadgeVariant(report.reason)}>
                {report.reason}
              </Badge>
            </td>

            {/* Item */}
            <td className="px-4 py-3 max-w-[200px]">
              {report.knowledge_item ? (
                <Link
                  href={`/knowledge/${report.knowledge_item.id}`}
                  className="text-dq-cyan hover:underline line-clamp-1"
                >
                  {report.knowledge_item.title}
                </Link>
              ) : (
                <span className="text-dq-text-muted">—</span>
              )}
            </td>

            {/* Reporter (truncated ID) */}
            <td className="px-4 py-3 font-mono text-xs text-dq-text-muted">
              {report.reporter_id.slice(0, 8)}…
            </td>

            {/* Status */}
            <td className="px-4 py-3">
              <Badge variant={statusBadgeVariant(report.status)}>
                {t(report.status as Parameters<typeof t>[0])}
              </Badge>
            </td>

            {/* Created */}
            <td className="px-4 py-3 text-sm text-dq-text-muted whitespace-nowrap">
              {new Date(report.created_at).toLocaleDateString()}
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-right">
              <ReportReviewActions
                reportId={report.id}
                currentStatus={report.status}
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/admin/reports"
        searchParams={activeTab !== "all" ? { status: activeTab } : {}}
      />
    </div>
  );
}
