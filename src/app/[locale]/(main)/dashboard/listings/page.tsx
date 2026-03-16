"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { deleteListing, publishListing } from "../../list/actions";
import {
  getContentDisplayLabel,
  getStatusLabel,
  getListingTypeLabel,
} from "@/types/knowledge.types";
import type { KnowledgeItem, Category, KnowledgeStatus } from "@/types/database.types";

type ListingWithCategory = KnowledgeItem & {
  category: Pick<Category, "id" | "name" | "slug"> | null;
};

const STATUS_VARIANT: Record<
  KnowledgeStatus,
  "default" | "success" | "warning" | "error"
> = {
  draft: "default",
  published: "success",
  archived: "warning",
  suspended: "error",
};

// ─── ActionMenu (mobile dropdown) ───────────────────────────────────────────

function ActionMenu({
  itemId,
  itemTitle,
  isDraft,
  onPublish,
  onDelete,
}: {
  itemId: string;
  itemTitle: string;
  isDraft: boolean;
  onPublish: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const tCommon = useTranslations("Common");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-sm p-2 text-dq-text-muted hover:text-dq-text hover:bg-dq-surface transition-colors"
        aria-label="Actions"
        aria-expanded={open}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-40 dq-window-sm">
          <Link
            href={`/list/${itemId}/edit`}
            className="block px-4 py-2.5 text-sm text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface"
            onClick={() => setOpen(false)}
          >
            {tCommon("edit")}
          </Link>
          {isDraft && (
            <button
              type="button"
              className="w-full px-4 py-2.5 text-left text-sm text-dq-cyan hover:bg-dq-surface"
              onClick={() => {
                onPublish(itemId);
                setOpen(false);
              }}
            >
              {tCommon("publish")}
            </button>
          )}
          <button
            type="button"
            className="w-full px-4 py-2.5 text-left text-sm text-dq-red hover:bg-dq-surface"
            onClick={() => {
              onDelete(itemId, itemTitle);
              setOpen(false);
            }}
          >
            {tCommon("delete")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardListingsPage() {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const tListing = useTranslations("Listing");
  const tKnowledge = useTranslations("Knowledge");
  const tTypes = useTranslations("Types");
  const [listings, setListings] = useState<ListingWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const fetchListings = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        if (authError) console.error("[listings] auth failed:", authError.message);
        return;
      }

      const { data, error } = await supabase
        .from("knowledge_items")
        .select("*, category:categories(id, name, slug)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[listings] fetch failed:", error.message);
        return;
      }
      setListings((data as ListingWithCategory[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchListings();
  }, []);

  const handleDeleteClick = (id: string, title: string) => {
    setDeleteTarget({ id, title });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { error } = await deleteListing(deleteTarget.id);
    if (!error) {
      setListings((prev) => prev.filter((l) => l.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const handlePublish = async (id: string) => {
    const { error } = await publishListing(id);
    if (!error) {
      fetchListings();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-dq-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-dq-text">
          {t("listings")}
        </h1>
        <Link href="/list">
          <Button variant="primary">{t("newListing")}</Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <Card padding="lg">
          <div className="text-center">
            <p className="text-dq-text-muted">
              {t("noListings")}
            </p>
            <Link href="/list" className="mt-4 inline-block">
              <Button variant="primary">{t("listFirstItem")}</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {listings.map((item) => (
            <Card key={item.id} padding="md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-dq-text">
                      {item.title}
                    </h2>
                    <Badge variant={STATUS_VARIANT[item.status]}>
                      {getStatusLabel(item.status, tTypes)}
                    </Badge>
                    <Badge>{getContentDisplayLabel(item.content_type, tTypes)}</Badge>
                    <Badge variant={item.listing_type === "request" ? "warning" : "success"}>
                      {getListingTypeLabel(item.listing_type, tTypes)}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-dq-text-sub">
                    {item.description}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-sm text-dq-text-muted">
                    {item.price_sol && <span>{item.price_sol} SOL</span>}
                    <span>{tKnowledge("viewCount", { count: item.view_count })}</span>
                    <span>
                      {item.listing_type === "request"
                        ? tKnowledge("reactionCount", { count: item.purchase_count })
                        : tKnowledge("purchaseCount", { count: item.purchase_count })}
                    </span>
                  </div>
                </div>

                {/* Desktop: inline buttons */}
                <div className="hidden sm:flex gap-2">
                  <Link href={`/list/${item.id}/edit`}>
                    <Button variant="outline" size="sm">
                      {tCommon("edit")}
                    </Button>
                  </Link>
                  {item.status === "draft" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePublish(item.id)}
                    >
                      {tCommon("publish")}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteClick(item.id, item.title)}
                  >
                    {tCommon("delete")}
                  </Button>
                </div>

                {/* Mobile: dropdown menu */}
                <div className="sm:hidden">
                  <ActionMenu
                    itemId={item.id}
                    itemTitle={item.title}
                    isDraft={item.status === "draft"}
                    onPublish={handlePublish}
                    onDelete={handleDeleteClick}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={tListing("deleteConfirmTitle")}
        size="sm"
      >
        <p className="mb-6 text-sm text-dq-text-sub">
          {tListing("deleteConfirmMessage", { title: deleteTarget?.title ?? "" })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            {tCommon("cancel")}
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>
            {tCommon("delete")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
