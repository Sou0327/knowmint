"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { reviewReport } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

interface ReportReviewActionsProps {
  reportId: string;
  currentStatus: string;
}

export default function ReportReviewActions({
  reportId,
  currentStatus,
}: ReportReviewActionsProps) {
  const t = useTranslations("Admin");
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [reviewerNote, setReviewerNote] = useState("");
  const [removeItem, setRemoveItem] = useState(false);

  const isActionable =
    currentStatus === "pending" || currentStatus === "reviewing";

  if (!isActionable) {
    const variant =
      currentStatus === "resolved"
        ? "success"
        : currentStatus === "dismissed"
          ? "default"
          : "default";
    return (
      <Badge variant={variant}>
        {t(currentStatus as Parameters<typeof t>[0])}
      </Badge>
    );
  }

  function handleAction(action: "resolve" | "dismiss" | "start_review") {
    startTransition(async () => {
      const result = await reviewReport(reportId, action, {
        reviewer_note: reviewerNote || undefined,
        remove_item: action === "resolve" ? removeItem : false,
      });
      if (result.success) {
        setShowForm(false);
        setReviewerNote("");
        setRemoveItem(false);
      } else {
        alert(result.error ?? "Failed");
      }
    });
  }

  if (showForm) {
    return (
      <div className="space-y-2">
        <textarea
          value={reviewerNote}
          onChange={(e) => setReviewerNote(e.target.value)}
          placeholder={t("reviewerNote")}
          rows={2}
          className="w-full rounded-sm border border-dq-border bg-dq-surface px-2 py-1.5 text-xs text-dq-text placeholder:text-dq-text-muted focus:border-dq-gold focus:outline-none"
        />
        <label className="flex items-center gap-2 text-xs text-dq-text-sub cursor-pointer">
          <input
            type="checkbox"
            checked={removeItem}
            onChange={(e) => setRemoveItem(e.target.checked)}
            className="rounded-sm"
          />
          {t("removeItem")}
        </label>
        <div className="flex gap-1.5">
          <Button
            variant="primary"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction("resolve")}
          >
            {t("resolve")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction("dismiss")}
          >
            {t("dismiss")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setShowForm(false)}
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {currentStatus === "pending" && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleAction("start_review")}
        >
          {t("startReview")}
        </Button>
      )}
      <Button
        variant="primary"
        size="sm"
        disabled={isPending}
        onClick={() => setShowForm(true)}
      >
        {t("resolve")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => handleAction("dismiss")}
      >
        {t("dismiss")}
      </Button>
    </div>
  );
}
