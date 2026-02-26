import { getTranslations } from "next-intl/server";
import type { ContentType } from "@/types/database.types";

interface Props {
  contentType: ContentType;
  content: string;
}

export default async function ContentPreview({ contentType, content }: Props) {
  const t = await getTranslations("Knowledge");

  if (!content) {
    return (
      <p className="text-sm text-dq-text-muted">
        {t("noPreview")}
      </p>
    );
  }

  const isCode = contentType === "tool_def" || contentType === "api";

  return (
    <div className="overflow-hidden rounded-sm border-2 border-dq-border">
      {isCode ? (
        <>
          <div className="flex items-center gap-2 border-b-2 border-dq-border bg-dq-surface px-4 py-2">
            <span className="text-xs font-medium text-dq-text-muted">
              {contentType === "tool_def" ? "JSON / テンプレート設定" : "外部リソース情報"}
            </span>
          </div>
          <pre className="overflow-x-auto bg-dq-window-bg p-4 font-mono text-[13px] leading-relaxed text-dq-text">
            <code>{content}</code>
          </pre>
        </>
      ) : (
        <div className="bg-dq-window-bg p-4">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-dq-text-sub">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
