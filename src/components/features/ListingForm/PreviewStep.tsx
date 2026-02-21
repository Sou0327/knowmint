"use client";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { CONTENT_TYPE_LABELS, LISTING_TYPE_LABELS } from "@/types/knowledge.types";
import type { ContentType, ListingType } from "@/types/database.types";
import type { RequestContentInput } from "@/lib/knowledge/requestContent";

interface Category {
  id: string;
  name: string;
}

interface PreviewData {
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  category_id: string;
  tags: string[];
  preview_content: string;
  request_content: RequestContentInput;
  price_sol: string;
  price_usdc: string;
}

interface Props {
  data: PreviewData;
  categories: Category[];
}

export default function PreviewStep({ data, categories }: Props) {
  const category = categories.find((c) => c.id === data.category_id);
  const isRequest = data.listing_type === "request";

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {isRequest
          ? "募集内容を確認してください。問題なければ公開できます。"
          : "出品内容を確認してください。問題なければ公開できます。"}
      </p>

      <Card padding="lg">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {data.title || "タイトル未設定"}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant={isRequest ? "warning" : "success"}>
                {LISTING_TYPE_LABELS[data.listing_type]}
              </Badge>
              <Badge>{CONTENT_TYPE_LABELS[data.content_type]}</Badge>
            </div>
          </div>

          {category && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {category.name}
            </p>
          )}

          <p className="text-zinc-700 dark:text-zinc-300">
            {data.description || "説明未設定"}
          </p>

          {data.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.tags.map((tag) => (
                <Badge key={tag} variant="info">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {isRequest ? (
            <div className="space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  必要な情報
                </h3>
                <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                  {data.request_content.needed_info || "未設定"}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  用途・背景
                </h3>
                <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                  {data.request_content.background || "未設定"}
                </p>
              </div>
              {data.request_content.delivery_conditions && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    納品条件
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                    {data.request_content.delivery_conditions}
                  </p>
                </div>
              )}
              {data.request_content.notes && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    補足
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                    {data.request_content.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                プレビュー
              </h3>
              <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                {data.preview_content || "プレビュー未設定"}
              </p>
            </div>
          )}

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isRequest ? "希望報酬" : "価格"}
            </h3>
            <div className="flex gap-4">
              {data.price_sol && (
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {data.price_sol} SOL
                </span>
              )}
              {data.price_usdc && (
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {data.price_usdc} USDC
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
