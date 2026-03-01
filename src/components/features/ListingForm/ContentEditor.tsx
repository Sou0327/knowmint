"use client";

import { useTranslations } from "next-intl";
import Textarea from "@/components/ui/Textarea";
import type { ContentType, ListingType } from "@/types/database.types";
import type { RequestContentInput } from "@/lib/knowledge/requestContent";

interface Props {
  listingType: ListingType;
  contentType: ContentType;
  previewContent: string;
  fullContent: string;
  requestContent: RequestContentInput;
  onPreviewChange: (value: string) => void;
  onFullContentChange: (value: string) => void;
  onRequestContentChange: (value: Partial<RequestContentInput>) => void;
  errors: Record<string, string>;
}

export default function ContentEditor({
  listingType,
  contentType,
  previewContent,
  fullContent,
  requestContent,
  onPreviewChange,
  onFullContentChange,
  onRequestContentChange,
  errors,
}: Props) {
  const t = useTranslations("Listing");

  const PLACEHOLDER_MAP: Record<ContentType, { preview: string; full: string }> = {
    prompt: {
      preview: t("placeholder.promptPreview"),
      full: t("placeholder.promptFull"),
    },
    tool_def: {
      preview: t("placeholder.toolPreview"),
      full: t("placeholder.toolFull"),
    },
    dataset: {
      preview: t("placeholder.datasetPreview"),
      full: t("placeholder.datasetFull"),
    },
    api: {
      preview: t("placeholder.apiPreview"),
      full: t("placeholder.apiFull"),
    },
    general: {
      preview: t("placeholder.generalPreview"),
      full: t("placeholder.generalFull"),
    },
  };

  const placeholders = PLACEHOLDER_MAP[contentType];
  const isCodeType = contentType === "tool_def" || contentType === "api";
  const isRequest = listingType === "request";

  if (isRequest) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("requestContentDesc")}
        </p>

        <Textarea
          label={t("neededInfo")}
          value={requestContent.needed_info}
          onChange={(e) =>
            onRequestContentChange({ needed_info: e.target.value })
          }
          rows={4}
          placeholder={t("neededInfoPlaceholder")}
          error={errors.request_needed_info}
        />

        <Textarea
          label={t("usageBackground")}
          value={requestContent.background}
          onChange={(e) => onRequestContentChange({ background: e.target.value })}
          rows={4}
          placeholder={t("backgroundPlaceholder")}
          error={errors.request_background}
        />

        <Textarea
          label={t("deliveryConditions")}
          value={requestContent.delivery_conditions}
          onChange={(e) =>
            onRequestContentChange({ delivery_conditions: e.target.value })
          }
          rows={3}
          placeholder={t("deliveryPlaceholder")}
          error={errors.request_delivery_conditions}
        />

        <Textarea
          label={t("notesLabel")}
          value={requestContent.notes}
          onChange={(e) => onRequestContentChange({ notes: e.target.value })}
          rows={3}
          placeholder={t("notesPlaceholder")}
          error={errors.request_notes}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("previewContent")}
        </h3>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          {t("previewContentDesc")}
        </p>
        <Textarea
          value={previewContent}
          onChange={(e) => onPreviewChange(e.target.value)}
          rows={6}
          placeholder={placeholders.preview}
          error={errors.preview_content}
          hint={isCodeType ? undefined : t("markdownHint")}
        />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("fullContent")}
        </h3>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          {t("fullContentDesc")}
        </p>
        <Textarea
          value={fullContent}
          onChange={(e) => onFullContentChange(e.target.value)}
          rows={12}
          placeholder={placeholders.full}
          error={errors.full_content}
          hint={isCodeType ? undefined : t("markdownHint")}
        />
      </div>
    </div>
  );
}
