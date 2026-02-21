"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { deleteListing, publishListing } from "../../list/actions";
import {
  CONTENT_TYPE_LABELS,
  STATUS_LABELS,
  LISTING_TYPE_LABELS,
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
    if (!confirm("この出品を削除しますか？")) return;
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          出品管理
        </h1>
        <Link href="/list">
          <Button variant="primary">新規出品</Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <Card padding="lg">
          <div className="text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              まだ出品がありません
            </p>
            <Link href="/list" className="mt-4 inline-block">
              <Button variant="primary">最初の知識を出品する</Button>
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
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </h2>
                    <Badge variant={STATUS_VARIANT[item.status]}>
                      {STATUS_LABELS[item.status]}
                    </Badge>
                    <Badge>{CONTENT_TYPE_LABELS[item.content_type]}</Badge>
                    <Badge variant={item.listing_type === "request" ? "warning" : "success"}>
                      {LISTING_TYPE_LABELS[item.listing_type]}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {item.description}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                    {item.price_sol && <span>{item.price_sol} SOL</span>}
                    {item.price_usdc && <span>{item.price_usdc} USDC</span>}
                    <span>{item.view_count} 閲覧</span>
                    <span>
                      {item.purchase_count} {item.listing_type === "request" ? "反応" : "購入"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/list/${item.id}/edit`}>
                    <Button variant="outline" size="sm">
                      編集
                    </Button>
                  </Link>
                  {item.status === "draft" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePublish(item.id)}
                    >
                      公開
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    削除
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
