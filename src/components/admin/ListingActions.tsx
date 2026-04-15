"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { suspendListing } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface ListingActionsProps {
  itemId: string;
  currentStatus: string;
}

export default function ListingActions({
  itemId,
  currentStatus,
}: ListingActionsProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const canSuspend = currentStatus === "published" || currentStatus === "draft";

  if (!canSuspend) {
    const variant = currentStatus === "suspended" ? "error" : "default";
    return <Badge variant={variant}>{currentStatus}</Badge>;
  }

  const runSuspend = () => {
    startTransition(async () => {
      const result = await suspendListing(itemId);
      if (!result.success) {
        toast.show(result.error ?? t("actionFailed"), { variant: "error" });
      }
      setConfirming(false);
    });
  };

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        disabled={isPending}
        loading={isPending}
        onClick={() => setConfirming(true)}
      >
        {t("suspend")}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={t("confirmSuspendTitle")}
        description={t("confirmSuspend")}
        confirmLabel={t("suspend")}
        cancelLabel={tCommon("cancel")}
        variant="danger"
        pending={isPending}
        onConfirm={runSuspend}
        onCancel={() => {
          if (!isPending) setConfirming(false);
        }}
      />
    </>
  );
}
