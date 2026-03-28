"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { suspendListing } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

interface ListingActionsProps {
  itemId: string;
  currentStatus: string;
}

export default function ListingActions({
  itemId,
  currentStatus,
}: ListingActionsProps) {
  const t = useTranslations("Admin");
  const [isPending, startTransition] = useTransition();

  const canSuspend = currentStatus === "published" || currentStatus === "draft";

  if (!canSuspend) {
    const variant = currentStatus === "suspended" ? "error" : "default";
    return <Badge variant={variant}>{currentStatus}</Badge>;
  }

  function handleSuspend() {
    if (!confirm(t("confirmSuspend"))) return;
    startTransition(async () => {
      const result = await suspendListing(itemId);
      if (!result.success) alert(result.error ?? "Failed");
    });
  }

  return (
    <Button
      variant="danger"
      size="sm"
      disabled={isPending}
      onClick={handleSuspend}
    >
      {isPending ? "..." : t("suspend")}
    </Button>
  );
}
