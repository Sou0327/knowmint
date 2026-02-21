"use client";

import { useState } from "react";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import type { ContentType, ListingType } from "@/types/database.types";
import { CONTENT_TYPE_LABELS } from "@/types/knowledge.types";
import type { KnowledgeMetadataForm } from "@/types/knowledge.types";

interface Category {
  id: string;
  name: string;
}

interface BasicInfoData {
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  category_id: string;
  tags: string[];
  metadata: KnowledgeMetadataForm;
}

interface Props {
  data: BasicInfoData;
  categories: Category[];
  onChange: (data: Partial<BasicInfoData>) => void;
  errors: Record<string, string>;
}

const contentTypeOptions = Object.entries(CONTENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

const domainOptions = [
  { value: "", label: "選択してください" },
  { value: "finance", label: "金融・ファイナンス" },
  { value: "engineering", label: "エンジニアリング" },
  { value: "marketing", label: "マーケティング" },
  { value: "legal", label: "法務・コンプライアンス" },
  { value: "medical", label: "医療・ヘルスケア" },
  { value: "education", label: "教育・研修" },
  { value: "other", label: "その他" },
];

const experienceTypeOptions = [
  { value: "", label: "選択してください" },
  { value: "case_study", label: "事例・ケーススタディ" },
  { value: "how_to", label: "ハウツー・手順" },
  { value: "template", label: "テンプレート" },
  { value: "checklist", label: "チェックリスト" },
  { value: "reference", label: "リファレンス" },
  { value: "other", label: "その他" },
];

const sourceTypeOptions = [
  { value: "", label: "選択してください" },
  { value: "personal_experience", label: "個人経験・実務知識" },
  { value: "research", label: "調査・研究" },
  { value: "industry_standard", label: "業界標準・ベストプラクティス" },
  { value: "other", label: "その他" },
];

const APPLICABLE_TO_OPTIONS = [
  { value: "GPT-4", label: "GPT-4" },
  { value: "Claude", label: "Claude" },
  { value: "Gemini", label: "Gemini" },
  { value: "any", label: "すべてのAI" },
];

export default function BasicInfoStep({
  data,
  categories,
  onChange,
  errors,
}: Props) {
  const [metadataOpen, setMetadataOpen] = useState(false);

  const categoryOptions = [
    { value: "", label: "カテゴリを選択" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleMetadataChange = (partial: Partial<KnowledgeMetadataForm>) => {
    onChange({ metadata: { ...data.metadata, ...partial } });
  };

  const handleApplicableToChange = (value: string, checked: boolean) => {
    const current = data.metadata.applicable_to;
    const updated = checked
      ? [...current, value]
      : current.filter((v) => v !== value);
    handleMetadataChange({ applicable_to: updated });
  };

  return (
    <div className="space-y-5">
      <Input
        label="タイトル"
        value={data.title}
        onChange={(e) => onChange({ title: e.target.value })}
        error={errors.title}
        required
        placeholder="知識のタイトルを入力"
      />

      <Textarea
        label="説明"
        value={data.description}
        onChange={(e) => onChange({ description: e.target.value })}
        error={errors.description}
        required
        rows={4}
        placeholder="この知識の概要を説明してください"
      />

      <Select
        label="コンテンツタイプ"
        value={data.content_type}
        onChange={(e) =>
          onChange({ content_type: e.target.value as ContentType })
        }
        options={contentTypeOptions}
        error={errors.content_type}
      />

      <Select
        label="カテゴリ"
        value={data.category_id}
        onChange={(e) => onChange({ category_id: e.target.value })}
        options={categoryOptions}
        error={errors.category_id}
      />

      <Input
        label="タグ"
        value={data.tags.join(", ")}
        onChange={(e) =>
          onChange({
            tags: e.target.value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          })
        }
        hint="カンマ区切りで入力（例: 業務改善, テンプレート, 初心者向け）"
      />

      {/* 詳細メタデータ（折りたたみ） */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => setMetadataOpen((prev) => !prev)}
        >
          <span>詳細メタデータ（任意）</span>
          <svg
            className={`h-4 w-4 transition-transform ${metadataOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {metadataOpen && (
          <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              メタデータを設定するとAIエージェントがこの知識を発見・評価しやすくなります。
            </p>

            <Select
              label="ドメイン"
              value={data.metadata.domain}
              onChange={(e) => handleMetadataChange({ domain: e.target.value })}
              options={domainOptions}
            />

            <Select
              label="経験タイプ"
              value={data.metadata.experience_type}
              onChange={(e) => handleMetadataChange({ experience_type: e.target.value })}
              options={experienceTypeOptions}
            />

            <Select
              label="情報ソース"
              value={data.metadata.source_type}
              onChange={(e) => handleMetadataChange({ source_type: e.target.value })}
              options={sourceTypeOptions}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                対応AIモデル
              </label>
              <div className="flex flex-wrap gap-3">
                {APPLICABLE_TO_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      checked={data.metadata.applicable_to.includes(opt.value)}
                      onChange={(e) => handleApplicableToChange(opt.value, e.target.checked)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
