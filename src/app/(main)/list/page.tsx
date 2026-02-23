"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import BasicInfoStep from "@/components/features/ListingForm/BasicInfoStep";
import ContentEditor from "@/components/features/ListingForm/ContentEditor";
import PricingStep from "@/components/features/ListingForm/PricingStep";
import PreviewStep from "@/components/features/ListingForm/PreviewStep";
import { createListing, publishListing } from "./actions";
import { createClient } from "@/lib/supabase/client";
import type { ContentType, ListingType } from "@/types/database.types";
import { LISTING_TYPE_LABELS } from "@/types/knowledge.types";
import type { RequestContentInput } from "@/lib/knowledge/requestContent";

const STEPS = ["基本情報", "コンテンツ", "価格設定", "確認・公開"];

interface FormData {
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  category_id: string;
  tags: string[];
  preview_content: string;
  full_content: string;
  request_content: RequestContentInput;
  price_sol: string;
  price_usdc: string;
  metadata: {
    domain: string;
    experience_type: string;
    applicable_to: string[];
    source_type: string;
  };
  seller_disclosure: string;
}

const initialForm: FormData = {
  listing_type: "offer",
  title: "",
  description: "",
  content_type: "general",
  category_id: "",
  tags: [],
  preview_content: "",
  full_content: "",
  request_content: {
    needed_info: "",
    background: "",
    delivery_conditions: "",
    notes: "",
  },
  price_sol: "",
  price_usdc: "",
  metadata: {
    domain: "",
    experience_type: "",
    applicable_to: [],
    source_type: "",
  },
  seller_disclosure: "",
};

export default function ListPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categories")
      .select("id, name")
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  const updateForm = (updates: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const clearedErrors = { ...errors };
    Object.keys(updates).forEach((key) => delete clearedErrors[key]);
    if (updates.request_content) {
      delete clearedErrors.request_needed_info;
      delete clearedErrors.request_background;
      delete clearedErrors.request_delivery_conditions;
      delete clearedErrors.request_notes;
    }
    if (updates.listing_type) {
      delete clearedErrors.request_needed_info;
      delete clearedErrors.request_background;
      delete clearedErrors.request_delivery_conditions;
      delete clearedErrors.request_notes;
    }
    setErrors(clearedErrors);
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!form.title.trim()) newErrors.title = "タイトルは必須です";
      if (!form.description.trim()) newErrors.description = "説明は必須です";
    }

    if (step === 2) {
      if (!form.price_sol && !form.price_usdc) {
        newErrors.price_sol =
          form.listing_type === "request"
            ? "少なくとも1つの希望報酬を設定してください"
            : "少なくとも1つの価格を設定してください";
      }
    }

    if (step === 1 && form.listing_type === "request") {
      if (!form.request_content.needed_info.trim()) {
        newErrors.request_needed_info = "必要な情報は必須です";
      }
      if (!form.request_content.background.trim()) {
        newErrors.request_background = "用途・背景は必須です";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const metadataPayload = {
        ...(form.metadata.domain ? { domain: form.metadata.domain } : {}),
        ...(form.metadata.experience_type ? { experience_type: form.metadata.experience_type } : {}),
        ...(form.metadata.applicable_to.length > 0 ? { applicable_to: form.metadata.applicable_to } : {}),
        ...(form.metadata.source_type ? { source_type: form.metadata.source_type } : {}),
      };
      const payload = {
        listing_type: form.listing_type,
        title: form.title,
        description: form.description,
        content_type: form.content_type,
        price_sol: form.price_sol ? parseFloat(form.price_sol) : null,
        price_usdc: form.price_usdc ? parseFloat(form.price_usdc) : null,
        preview_content: form.preview_content,
        full_content: form.full_content,
        ...(form.listing_type === "request"
          ? { request_content: form.request_content }
          : {}),
        category_id: form.category_id,
        tags: form.tags,
        metadata: Object.keys(metadataPayload).length > 0 ? metadataPayload : null,
        ...(form.seller_disclosure.trim() ? { seller_disclosure: form.seller_disclosure.trim() } : {}),
      };
      const { error, id } = await createListing(payload);

      if (error) {
        setErrors({ submit: error });
        return;
      }

      if (!asDraft && id) {
        const { error: pubError } = await publishListing(id);
        if (pubError) {
          setErrors({ submit: pubError });
          return;
        }
      }

      router.push("/dashboard/listings");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "作成処理に失敗しました";
      setErrors({ submit: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          知識を掲載する
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          出品または募集を作成して、必要な相手とつながりましょう
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          現在の掲載種別: {LISTING_TYPE_LABELS[form.listing_type]}
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                i < step
                  ? "bg-blue-600 text-white"
                  : i === step
                    ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/50"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
              }`}
            >
              {i < step ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`hidden text-sm sm:inline transition-all duration-300 ${
                i === step
                  ? "font-medium text-zinc-900 dark:text-zinc-100"
                  : i < step
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 transition-all duration-300 ${
                  i < step
                    ? "bg-blue-600"
                    : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {errors.submit && (
        <div className="mb-4 rounded-lg border-l-4 border-l-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {errors.submit}
        </div>
      )}

      {/* Step content */}
      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {step === 0 && (
          <BasicInfoStep
            data={form}
            categories={categories}
            onChange={updateForm}
            errors={errors}
          />
        )}
        {step === 1 && (
          <ContentEditor
            listingType={form.listing_type}
            contentType={form.content_type}
            previewContent={form.preview_content}
            fullContent={form.full_content}
            requestContent={form.request_content}
            onPreviewChange={(v) => updateForm({ preview_content: v })}
            onFullContentChange={(v) => updateForm({ full_content: v })}
            onRequestContentChange={(v) =>
              updateForm({
                request_content: {
                  ...form.request_content,
                  ...v,
                },
              })
            }
            errors={errors}
          />
        )}
        {step === 2 && (
          <PricingStep
            listingType={form.listing_type}
            priceSol={form.price_sol}
            priceUsdc={form.price_usdc}
            onPriceSolChange={(v) => updateForm({ price_sol: v })}
            onPriceUsdcChange={(v) => updateForm({ price_usdc: v })}
            errors={errors}
          />
        )}
        {step === 3 && (
          <PreviewStep data={form} categories={categories} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between border-t border-zinc-200 pt-6 dark:border-zinc-700">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0}
        >
          戻る
        </Button>

        <div className="flex gap-4">
          {step === STEPS.length - 1 ? (
            <>
              <Button
                variant="secondary"
                onClick={() => handleSubmit(true)}
                loading={submitting}
              >
                下書き保存
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSubmit(false)}
                loading={submitting}
              >
                公開する
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={handleNext}>
              次へ
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
