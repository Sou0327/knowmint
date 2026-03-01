import { getTranslations } from "next-intl/server";
import { MarkdownAsync } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { ComponentPropsWithoutRef } from "react";
import type { ContentType } from "@/types/database.types";

function TableWrapper({ node, ...props }: ComponentPropsWithoutRef<"table"> & { node?: unknown }) {
  void node;
  return (
    <div className="prose-dq-table-wrap">
      <table {...props} />
    </div>
  );
}

interface Props {
  contentType: ContentType;
  content: string;
}

export default async function ContentPreview({ contentType, content }: Props) {
  const t = await getTranslations("Knowledge");
  const tTypes = await getTranslations("Types");

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
              {contentType === "tool_def" ? tTypes("contentFormat.jsonTemplate") : tTypes("contentFormat.externalResource")}
            </span>
          </div>
          <pre className="overflow-x-auto bg-dq-window-bg p-4 font-mono text-[13px] leading-relaxed text-dq-text">
            <code>{content}</code>
          </pre>
        </>
      ) : (
        <div className="bg-dq-window-bg p-4">
          <div className="prose-dq text-sm">
            {await MarkdownAsync({
              children: content,
              remarkPlugins: [remarkGfm, remarkBreaks],
              disallowedElements: ["img"],
              unwrapDisallowed: true,
              components: { table: TableWrapper },
            })}
          </div>
        </div>
      )}
    </div>
  );
}
