"use client";

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

const PLACEHOLDER_MAP: Record<ContentType, { preview: string; full: string }> =
  {
    prompt: {
      preview: "内容の概要や活用シーンを記載...",
      full: "本文・手順・解説などを入力...",
    },
    tool_def: {
      preview: "テンプレートや設定ファイルの概要...",
      full: "テンプレート内容、設定値、利用手順を入力...",
    },
    dataset: {
      preview: "データ/資料の概要とサンプル...",
      full: "データの項目説明、取得方法、利用条件など...",
    },
    api: {
      preview: "外部リソースや参照先の概要...",
      full: "URL、参照手順、必要な情報など...",
    },
    general: {
      preview: "ナレッジの概要やポイント...",
      full: "詳細なナレッジ内容を入力...",
    },
  };

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
  const placeholders = PLACEHOLDER_MAP[contentType];
  const isRequest = listingType === "request";

  if (isRequest) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          募集内容を具体的に記載してください。公開時にこの内容から募集ページを生成します。
        </p>

        <Textarea
          label="必要な情報"
          value={requestContent.needed_info}
          onChange={(e) =>
            onRequestContentChange({ needed_info: e.target.value })
          }
          rows={4}
          placeholder="どのような情報・知見を求めているかを明記してください"
          error={errors.request_needed_info}
        />

        <Textarea
          label="用途・背景"
          value={requestContent.background}
          onChange={(e) => onRequestContentChange({ background: e.target.value })}
          rows={4}
          placeholder="利用目的、背景、解決したい課題を記載してください"
          error={errors.request_background}
        />

        <Textarea
          label="納品条件"
          value={requestContent.delivery_conditions}
          onChange={(e) =>
            onRequestContentChange({ delivery_conditions: e.target.value })
          }
          rows={3}
          placeholder="希望フォーマット、納期、必須要件など（任意）"
          error={errors.request_delivery_conditions}
        />

        <Textarea
          label="補足"
          value={requestContent.notes}
          onChange={(e) => onRequestContentChange({ notes: e.target.value })}
          rows={3}
          placeholder="参考URL、注意点、優先事項など（任意）"
          error={errors.request_notes}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          プレビューコンテンツ
        </h3>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          購入前に公開される内容です。興味を引く概要を記載してください。
        </p>
        <Textarea
          value={previewContent}
          onChange={(e) => onPreviewChange(e.target.value)}
          rows={6}
          placeholder={placeholders.preview}
          error={errors.preview_content}
        />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          フルコンテンツ
        </h3>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          購入後に閲覧できるコンテンツです。
        </p>
        <Textarea
          value={fullContent}
          onChange={(e) => onFullContentChange(e.target.value)}
          rows={12}
          placeholder={placeholders.full}
          error={errors.full_content}
        />
      </div>
    </div>
  );
}
