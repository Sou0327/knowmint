"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { submitFeedback } from "@/app/[locale]/(main)/library/[id]/actions";

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
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={submitting}
          onClick={() => handleFeedback(true)}
          className="border-dq-green text-dq-green hover:bg-dq-green/10"
        >
          <span aria-hidden="true">👍</span> {t("useful")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={submitting}
          onClick={() => handleFeedback(false)}
          className="border-dq-red text-dq-red hover:bg-dq-red/10"
        >
          <span aria-hidden="true">👎</span> {t("notUseful")}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-dq-red">{error}</p>}
    </div>
  );
}
