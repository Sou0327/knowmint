"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { submitReview } from "@/app/(main)/knowledge/[id]/actions";

interface Props {
  knowledgeItemId: string;
  onReviewSubmitted?: () => void;
}

export default function ReviewForm({ knowledgeItemId, onReviewSubmitted }: Props) {
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
      <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
        レビューを投稿しました
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          評価
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-2xl ${
                star <= rating
                  ? "text-yellow-500"
                  : "text-zinc-300 dark:text-zinc-600"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <Textarea
        label="コメント（任意）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="この知識についてのコメント..."
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <Button type="submit" variant="primary" loading={submitting}>
        レビューを投稿
      </Button>
    </form>
  );
}
