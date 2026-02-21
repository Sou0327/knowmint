import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { hasAccess } from "@/lib/knowledge/access";
import { getKnowledgeById } from "@/lib/knowledge/queries";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createDatasetSignedDownloadUrl } from "@/lib/storage/datasets";

export const dynamic = "force-dynamic";
import Badge from "@/components/ui/Badge";
import ContentPreview from "@/components/features/ContentPreview";
import { CONTENT_TYPE_LABELS } from "@/types/knowledge.types";
import type { ContentType } from "@/types/database.types";

interface Props {
  params: Promise<{ id: string }>;
}

// file_url の安全性を検証
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default async function LibraryItemPage({ params }: Props) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const item = await getKnowledgeById(id);

  if (!item) notFound();

  const canAccess = await hasAccess(user.id, id);

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          アクセス権限がありません
        </h1>
        <p className="mb-4 text-zinc-600 dark:text-zinc-400">
          このコンテンツを閲覧するには購入が必要です。
        </p>
        <Link
          href={`/knowledge/${id}`}
          className="text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          詳細ページへ →
        </Link>
      </div>
    );
  }

  // コンテンツ分離テーブルから full_content / file_url を取得
  const supabase = await createClient();
  const { data: content } = await supabase
    .from("knowledge_item_contents")
    .select("full_content, file_url")
    .eq("knowledge_item_id", id)
    .single();

  let downloadUrl: string | null = null;
  if (content?.file_url) {
    try {
      downloadUrl = await createDatasetSignedDownloadUrl(
        getAdminClient(),
        content.file_url,
        900
      );
    } catch {
      downloadUrl = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/library"
        className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
      >
        ← ライブラリに戻る
      </Link>

      <div className="mb-4 flex items-center gap-2">
        <Badge>{CONTENT_TYPE_LABELS[item.content_type as ContentType]}</Badge>
      </div>

      <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {item.title}
      </h1>

      <div className="mb-6">
        <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {item.description}
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          コンテンツ
        </h2>
        {content?.full_content ? (
          <ContentPreview
            contentType={item.content_type as ContentType}
            content={content.full_content}
          />
        ) : (downloadUrl || content?.file_url) && isSafeUrl(downloadUrl || content?.file_url || "") ? (
          <a
            href={downloadUrl || content?.file_url || ""}
            download
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            ファイルをダウンロード
          </a>
        ) : (
          <p className="text-zinc-500 dark:text-zinc-400">
            コンテンツがありません
          </p>
        )}
      </div>
    </div>
  );
}
