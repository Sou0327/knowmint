"use client";

import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { getContentDisplayLabel, getListingTypeLabel } from "@/types/knowledge.types";
import { getCategoryDisplayName } from "@/lib/i18n/category";
import type { ContentType, ListingType } from "@/types/database.types";
import type { RequestContentInput } from "@/lib/knowledge/requestContent";

interface Category {
  id: string;
  name: string;
  slug: string;
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
}

interface Props {
  data: PreviewData;
  categories: Category[];
}

export default function PreviewStep({ data, categories }: Props) {
  const t = useTranslations("Listing");
  const tTypes = useTranslations("Types");
  const category = categories.find((c) => c.id === data.category_id);
  const isRequest = data.listing_type === "request";

  return (
    <div className="space-y-6">
      <p className="text-sm text-dq-text-sub">
        {isRequest ? t("reviewRequestDesc") : t("reviewDesc")}
      </p>

      <Card padding="lg">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold text-dq-text">
              {data.title || t("noTitle")}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant={isRequest ? "warning" : "success"}>
                {getListingTypeLabel(data.listing_type, tTypes)}
              </Badge>
              <Badge>{getContentDisplayLabel(data.content_type, tTypes)}</Badge>
            </div>
          </div>

          {category && (
            <p className="text-sm text-dq-text-muted">
              {getCategoryDisplayName(tTypes, category.slug, category.name)}
            </p>
          )}

          <p className="text-dq-text-sub">
            {data.description || t("noDescription")}
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
            <div className="space-y-4 border-t border-dq-border pt-4">
              <div>
                <h3 className="mb-2 text-sm font-medium text-dq-text-sub">
                  {t("neededInfo")}
                </h3>
                <p className="whitespace-pre-wrap text-sm text-dq-text-muted">
                  {data.request_content.needed_info || t("notSet")}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-dq-text-sub">
                  {t("usageBackground")}
                </h3>
                <p className="whitespace-pre-wrap text-sm text-dq-text-muted">
                  {data.request_content.background || t("notSet")}
                </p>
              </div>
              {data.request_content.delivery_conditions && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-dq-text-sub">
                    {t("deliveryConditions")}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-dq-text-muted">
                    {data.request_content.delivery_conditions}
                  </p>
                </div>
              )}
              {data.request_content.notes && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-dq-text-sub">
                    {t("notesLabel")}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-dq-text-muted">
                    {data.request_content.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-dq-border pt-4">
              <h3 className="mb-2 text-sm font-medium text-dq-text-sub">
                {t("previewContent")}
              </h3>
              <p className="whitespace-pre-wrap text-sm text-dq-text-muted">
                {data.preview_content || t("noPreview")}
              </p>
            </div>
          )}

          <div className="border-t border-dq-border pt-4">
            <h3 className="mb-2 text-sm font-medium text-dq-text-sub">
              {isRequest ? t("desiredReward") : t("price")}
            </h3>
            <div className="flex gap-4">
              {data.price_sol && (
                <span className="text-lg font-bold text-dq-text">
                  {data.price_sol} SOL
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
