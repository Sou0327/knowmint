"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import BasicInfoStep from "@/components/features/ListingForm/BasicInfoStep";
import ContentEditor from "@/components/features/ListingForm/ContentEditor";
import PricingStep from "@/components/features/ListingForm/PricingStep";
import PreviewStep from "@/components/features/ListingForm/PreviewStep";
import { updateListing } from "../../actions";
import { createClient } from "@/lib/supabase/client";
import type { ContentType, ListingType } from "@/types/database.types";
import { LISTING_TYPE_LABELS } from "@/types/knowledge.types";
import type { RequestContentInput } from "@/lib/knowledge/requestContent";
import { parseRequestFullContent } from "@/lib/knowledge/requestContent";

const STEPS = ["基本情報", "コンテンツ", "価格設定", "確認・更新"];

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

const EMPTY_REQUEST_CONTENT: RequestContentInput = {
  needed_info: "",
  background: "",
  delivery_conditions: "",
  notes: "",
};

const initialForm: FormData = {
  listing_type: "offer",
  title: "",
  description: "",
  content_type: "general",
  category_id: "",
  tags: [],
  preview_content: "",
  full_content: "",
  request_content: EMPTY_REQUEST_CONTENT,
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

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const listingId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      if (!listingId) return;
      setLoading(true);

      try {
        const supabase = createClient();
        const [{ data: categoryData }, { data: authData }] = await Promise.all([
          supabase.from("categories").select("id, name"),
          supabase.auth.getUser(),
        ]);

        if (!active) return;
        if (categoryData) setCategories(categoryData);

        const user = authData.user;
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: item, error: itemError } = await supabase
          .from("knowledge_items")
          .select(
            "id, seller_id, listing_type, title, description, content_type, category_id, tags, preview_content, price_sol, price_usdc, metadata, seller_disclosure"
          )
          .eq("id", listingId)
          .single();

        if (!active) return;
        if (itemError || !item || item.seller_id !== user.id) {
          setErrors({ submit: "編集対象の掲載が見つかりません" });
          return;
        }

        const { data: contentRow } = await supabase
          .from("knowledge_item_contents")
          .select("full_content")
          .eq("knowledge_item_id", listingId)
          .maybeSingle();

        if (!active) return;
        const requestContent =
          item.listing_type === "request"
            ? parseRequestFullContent(contentRow?.full_content)
            : EMPTY_REQUEST_CONTENT;

        const rawMeta = (typeof item.metadata === "object" && item.metadata !== null && !Array.isArray(item.metadata))
          ? item.metadata as Record<string, unknown>
          : {};
        const existingMetadata = {
          domain: typeof rawMeta.domain === "string" ? rawMeta.domain : "",
          experience_type: typeof rawMeta.experience_type === "string" ? rawMeta.experience_type : "",
          applicable_to: Array.isArray(rawMeta.applicable_to)
            ? (rawMeta.applicable_to as unknown[]).filter((v): v is string => typeof v === "string")
            : [],
          source_type: typeof rawMeta.source_type === "string" ? rawMeta.source_type : "",
        };
        setForm({
          listing_type: item.listing_type as ListingType,
          title: item.title || "",
          description: item.description || "",
          content_type: item.content_type as ContentType,
          category_id: item.category_id || "",
          tags: (item.tags as string[] | null) ?? [],
          preview_content: item.preview_content || "",
          full_content: contentRow?.full_content || "",
          request_content: requestContent,
          price_sol:
            item.price_sol !== null && item.price_sol !== undefined
              ? String(item.price_sol)
              : "",
          price_usdc:
            item.price_usdc !== null && item.price_usdc !== undefined
              ? String(item.price_usdc)
              : "",
          metadata: existingMetadata,
          seller_disclosure: item.seller_disclosure || "",
        });
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "読み込みに失敗しました";
        setErrors({ submit: message });
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialData();
    return () => {
      active = false;
    };
  }, [listingId, router]);

  const updateForm = (updates: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
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

    if (step === 1 && form.listing_type === "request") {
      if (!form.request_content.needed_info.trim()) {
        newErrors.request_needed_info = "必要な情報は必須です";
      }
      if (!form.request_content.background.trim()) {
        newErrors.request_background = "用途・背景は必須です";
      }
    }

    if (step === 2) {
      if (!form.price_sol && !form.price_usdc) {
        newErrors.price_sol =
          form.listing_type === "request"
            ? "少なくとも1つの希望報酬を設定してください"
            : "少なくとも1つの価格を設定してください";
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

  const handleSave = async () => {
    if (!listingId || submitting) return;
    setSubmitting(true);

    try {
      const metadataPayload = {
        ...(form.metadata.domain ? { domain: form.metadata.domain } : {}),
        ...(form.metadata.experience_type ? { experience_type: form.metadata.experience_type } : {}),
        ...(form.metadata.applicable_to.length > 0 ? { applicable_to: form.metadata.applicable_to } : {}),
        ...(form.metadata.source_type ? { source_type: form.metadata.source_type } : {}),
      };
      const payload: Record<string, unknown> = {
        listing_type: form.listing_type,
        title: form.title,
        description: form.description,
        content_type: form.content_type,
        price_sol: form.price_sol ? parseFloat(form.price_sol) : null,
        price_usdc: form.price_usdc ? parseFloat(form.price_usdc) : null,
        preview_content: form.preview_content,
        full_content: form.full_content,
        category_id: form.category_id,
        tags: form.tags,
        metadata: Object.keys(metadataPayload).length > 0 ? metadataPayload : {},
        seller_disclosure: form.seller_disclosure,
      };

      if (form.listing_type === "request") {
        payload.request_content = form.request_content;
      }

      const { error } = await updateListing(listingId, payload);
      if (error) {
        setErrors({ submit: error });
        return;
      }

      router.push("/dashboard/listings");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新処理に失敗しました";
      setErrors({ submit: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-dq-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-dq-text">
          掲載を編集する
        </h1>
        <p className="mt-2 text-sm text-dq-text-muted">
          掲載内容を編集して保存できます
        </p>
        <p className="mt-1 text-xs text-dq-text-muted">
          現在の掲載種別: {LISTING_TYPE_LABELS[form.listing_type]}
        </p>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                i < step
                  ? "bg-dq-gold text-dq-bg"
                  : i === step
                    ? "bg-dq-gold text-dq-bg ring-4 ring-dq-gold/30"
                    : "bg-dq-surface text-dq-text-muted"
              }`}
            >
              {i < step ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`hidden text-sm sm:inline transition-all duration-300 ${
                i === step
                  ? "font-medium text-dq-text"
                  : i < step
                    ? "text-dq-text"
                    : "text-dq-text-muted"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 transition-all duration-300 ${
                  i < step ? "bg-dq-gold" : "bg-dq-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {errors.submit && (
        <div className="mb-4 rounded-sm border-l-4 border-l-dq-red bg-dq-red/10 p-3 text-sm text-dq-red">
          {errors.submit}
        </div>
      )}

      <div className="mb-8 rounded-sm border border-dq-border bg-dq-window-bg p-6">
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
        {step === 3 && <PreviewStep data={form} categories={categories} />}
      </div>

      <div className="flex justify-between border-t border-dq-border pt-6">
        <Button variant="outline" onClick={handleBack} disabled={step === 0}>
          戻る
        </Button>

        <div className="flex gap-4">
          {step === STEPS.length - 1 ? (
            <Button variant="primary" onClick={handleSave} loading={submitting}>
              更新する
            </Button>
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
