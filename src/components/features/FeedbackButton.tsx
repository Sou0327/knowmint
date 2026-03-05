"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitFeedback } from "@/app/(main)/library/[id]/actions";

interface Props {
  knowledgeItemId: string;
  existingFeedback?: boolean | null;
}

export default function FeedbackButton({ knowledgeItemId, existingFeedback }: Props) {
  const t = useTranslations("Feedback");
  const [submitted, setSubmitted] = useState(existingFeedback != null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFeedback = async (useful: boolean) => {
    setSubmitting(true);
    setError(null);

    try {
      const { error } = await submitFeedback({ knowledgeItemId, useful });

      if (error) {
        setError(error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError(t("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <p className="text-sm text-dq-green">{t("thankYou")}</p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-dq-text-sub">{t("wasThisUseful")}</p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleFeedback(true)}
          className="rounded-sm border border-dq-border px-4 py-2 text-sm text-dq-green transition-colors hover:bg-dq-green/10 disabled:opacity-50"
        >
          👍 {t("useful")}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleFeedback(false)}
          className="rounded-sm border border-dq-border px-4 py-2 text-sm text-dq-red transition-colors hover:bg-dq-red/10 disabled:opacity-50"
        >
          👎 {t("notUseful")}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-dq-red">{error}</p>}
    </div>
  );
}
