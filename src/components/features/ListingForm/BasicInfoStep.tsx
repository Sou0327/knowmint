"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  seller_disclosure?: string;
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

export default function BasicInfoStep({
  data,
  categories,
  onChange,
  errors,
}: Props) {
  const t = useTranslations("Listing");
  const [metadataOpen, setMetadataOpen] = useState(false);

  const categoryOptions = [
    { value: "", label: t("selectCategory") },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const domainOptions = [
    { value: "", label: t("selectOption") },
    { value: "finance", label: t("domain.finance") },
    { value: "engineering", label: t("domain.engineering") },
    { value: "marketing", label: t("domain.marketing") },
    { value: "legal", label: t("domain.legal") },
    { value: "medical", label: t("domain.medical") },
    { value: "education", label: t("domain.education") },
    { value: "other", label: t("domain.other") },
  ];

  const experienceTypeOptions = [
    { value: "", label: t("selectOption") },
    { value: "case_study", label: t("experienceType.caseStudy") },
    { value: "how_to", label: t("experienceType.howTo") },
    { value: "template", label: t("experienceType.template") },
    { value: "checklist", label: t("experienceType.checklist") },
    { value: "reference", label: t("experienceType.reference") },
    { value: "other", label: t("experienceType.other") },
  ];

  const sourceTypeOptions = [
    { value: "", label: t("selectOption") },
    { value: "personal_experience", label: t("sourceType.personalExperience") },
    { value: "research", label: t("sourceType.research") },
    { value: "industry_standard", label: t("sourceType.industryStandard") },
    { value: "other", label: t("sourceType.other") },
  ];

  const APPLICABLE_TO_OPTIONS = [
    { value: "GPT-4", label: "GPT-4" },
    { value: "Claude", label: "Claude" },
    { value: "Gemini", label: "Gemini" },
    { value: "any", label: t("allAI") },
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
        label={t("titleLabel")}
        value={data.title}
        onChange={(e) => onChange({ title: e.target.value })}
        error={errors.title}
        required
        placeholder={t("enterTitle")}
      />

      <Textarea
        label={t("descriptionLabel")}
        value={data.description}
        onChange={(e) => onChange({ description: e.target.value })}
        error={errors.description}
        required
        rows={4}
        placeholder={t("enterDescription")}
      />

      <Select
        label={t("contentTypeLabel")}
        value={data.content_type}
        onChange={(e) =>
          onChange({ content_type: e.target.value as ContentType })
        }
        options={contentTypeOptions}
        error={errors.content_type}
      />

      <Select
        label={t("categoryLabel")}
        value={data.category_id}
        onChange={(e) => onChange({ category_id: e.target.value })}
        options={categoryOptions}
        error={errors.category_id}
      />

      <Input
        label={t("tags")}
        value={data.tags.join(", ")}
        onChange={(e) =>
          onChange({
            tags: e.target.value
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          })
        }
        hint={t("tagsHint")}
      />

      {/* Detailed metadata (collapsible) */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => setMetadataOpen((prev) => !prev)}
        >
          <span>{t("detailedMetadata")}</span>
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
              {t("metadataHint")}
            </p>

            <Select
              label={t("domainLabel")}
              value={data.metadata.domain}
              onChange={(e) => handleMetadataChange({ domain: e.target.value })}
              options={domainOptions}
            />

            <Select
              label={t("experienceTypeLabel")}
              value={data.metadata.experience_type}
              onChange={(e) => handleMetadataChange({ experience_type: e.target.value })}
              options={experienceTypeOptions}
            />

            <Select
              label={t("sourceTypeLabel")}
              value={data.metadata.source_type}
              onChange={(e) => handleMetadataChange({ source_type: e.target.value })}
              options={sourceTypeOptions}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t("applicableAI")}
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

            <div>
              <label
                htmlFor="seller-disclosure"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {t("sellerDisclosure")}
              </label>
              <textarea
                id="seller-disclosure"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                rows={2}
                maxLength={500}
                value={data.seller_disclosure ?? ""}
                onChange={(e) => onChange({ seller_disclosure: e.target.value })}
                placeholder={t("sellerDisclosurePlaceholder")}
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {t("sellerDisclosureHint")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
