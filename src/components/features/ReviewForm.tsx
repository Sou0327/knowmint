"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { submitReview } from "@/app/(main)/knowledge/[id]/actions";

interface Props {
  knowledgeItemId: string;
  onReviewSubmitted?: () => void;
}

export default function ReviewForm({ knowledgeItemId, onReviewSubmitted }: Props) {
  const t = useTranslations("Review");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error } = await submitReview({
      knowledgeItemId,
      rating,
      comment,
    });

    if (error) {
      setError(error);
    } else {
      setSubmitted(true);
      onReviewSubmitted?.();
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="rounded-sm border-2 border-dq-green/40 bg-dq-green/10 p-4 text-sm text-dq-green">
        {t("reviewSubmitted")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-dq-text-sub">
          {t("rating")}
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-2xl ${
                star <= rating
                  ? "text-dq-gold"
                  : "text-dq-text-muted"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <Textarea
        label={t("comment")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder={t("commentPlaceholder")}
      />

      {error && (
        <p className="text-sm text-dq-red">{error}</p>
      )}

      <Button type="submit" variant="primary" loading={submitting}>
        {t("submitReview")}
      </Button>
    </form>
  );
}
