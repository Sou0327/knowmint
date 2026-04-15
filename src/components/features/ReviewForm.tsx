"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { submitReview } from "@/app/[locale]/(main)/knowledge/[id]/actions";

interface Props {
  knowledgeItemId: string;
  onReviewSubmitted?: () => void;
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export default function ReviewForm({ knowledgeItemId, onReviewSubmitted }: Props) {
  const t = useTranslations("Review");
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
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
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const focusStar = (nextRating: number) => {
    const idx = STAR_VALUES.indexOf(
      nextRating as (typeof STAR_VALUES)[number],
    );
    if (idx === -1) return;
    buttonRefs.current[idx]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        setRating((r) => {
          const next = Math.min(5, r + 1);
          focusStar(next);
          return next;
        });
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        setRating((r) => {
          const next = Math.max(1, r - 1);
          focusStar(next);
          return next;
        });
        break;
      case "Home":
        e.preventDefault();
        setRating(1);
        focusStar(1);
        break;
      case "End":
        e.preventDefault();
        setRating(5);
        focusStar(5);
        break;
    }
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
        <label
          id="review-rating-label"
          className="mb-1 block text-sm font-medium text-dq-text-sub"
        >
          {t("rating")}
        </label>
        <div
          role="radiogroup"
          aria-labelledby="review-rating-label"
          className="flex gap-1"
          onKeyDown={handleKeyDown}
        >
          {STAR_VALUES.map((star, idx) => {
            const checked = star === rating;
            return (
              <button
                key={star}
                ref={(el) => {
                  buttonRefs.current[idx] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={t("ratingNStars", { n: star })}
                tabIndex={checked ? 0 : -1}
                onClick={() => setRating(star)}
                className={`text-2xl focus:outline-none focus:ring-2 focus:ring-dq-gold focus:ring-offset-1 focus:ring-offset-dq-bg rounded-sm ${
                  star <= rating
                    ? "text-dq-gold"
                    : "text-dq-text-muted"
                }`}
              >
                <span aria-hidden="true">★</span>
              </button>
            );
          })}
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
