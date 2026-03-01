"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
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

export default function DashboardListingsPage() {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const tListing = useTranslations("Listing");
  const tKnowledge = useTranslations("Knowledge");
  const tTypes = useTranslations("Types");
  const [listings, setListings] = useState<ListingWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("knowledge_items")
      .select("*, category:categories(id, name, slug)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    setListings((data as ListingWithCategory[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchListings();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(tListing("deleteConfirm"))) return;
    const { error } = await deleteListing(id);
    if (!error) {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }
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
                <div className="flex gap-2">
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
                    onClick={() => handleDelete(item.id)}
                  >
                    {tCommon("delete")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
