"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { banUser, unbanUser } from "@/app/actions/admin";

interface UserBanActionsProps {
  userId: string;
  isBanned: boolean;
  isAdmin: boolean;
}

type PendingAction = "ban" | "unban" | null;

export default function UserBanActions({
  userId,
  isBanned,
  isAdmin,
}: UserBanActionsProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  if (isAdmin) {
    return null;
  }

  const runAction = (action: Exclude<PendingAction, null>) => {
    startTransition(async () => {
      const result =
        action === "ban" ? await banUser(userId) : await unbanUser(userId);
      if (!result.success) {
        toast.show(result.error ?? t("actionFailed"), { variant: "error" });
      }
      setPendingAction(null);
    });
  };

  const dialogTitle =
    pendingAction === "ban" ? t("confirmBanTitle") : t("confirmUnbanTitle");
  const dialogDescription =
    pendingAction === "ban" ? t("confirmBan") : t("confirmUnban");
  const dialogConfirmLabel =
    pendingAction === "ban" ? t("ban") : t("unban");

  const button = isBanned ? (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      loading={isPending}
      onClick={() => setPendingAction("unban")}
    >
      {t("unban")}
    </Button>
  ) : (
    <Button
      variant="danger"
      size="sm"
      disabled={isPending}
      loading={isPending}
      onClick={() => setPendingAction("ban")}
    >
      {t("ban")}
    </Button>
  );

  return (
    <>
      {button}
      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={dialogConfirmLabel}
        cancelLabel={tCommon("cancel")}
        variant={pendingAction === "ban" ? "danger" : "default"}
        pending={isPending}
        onConfirm={() => {
          if (pendingAction) runAction(pendingAction);
        }}
        onCancel={() => {
          if (!isPending) setPendingAction(null);
        }}
      />
    </>
  );
}
