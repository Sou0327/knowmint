import type { ContentType } from "@/types/database.types";

interface Props {
  contentType: ContentType;
  content: string;
}

export default function ContentPreview({ contentType, content }: Props) {
  if (!content) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        プレビューはありません
      </p>
    );
  }

  const isCode = contentType === "tool_def" || contentType === "api";

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
      {isCode ? (
        <>
          <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {contentType === "tool_def" ? "JSON / テンプレート設定" : "外部リソース情報"}
            </span>
          </div>
          <pre className="overflow-x-auto bg-zinc-50 p-4 font-mono text-[13px] leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            <code>{content}</code>
          </pre>
        </>
      ) : (
        <div className="bg-white p-4 dark:bg-zinc-900">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-zinc-700 dark:prose-invert dark:text-zinc-300">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
