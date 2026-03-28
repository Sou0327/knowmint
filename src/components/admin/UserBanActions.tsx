"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { banUser, unbanUser } from "@/app/actions/admin";

interface UserBanActionsProps {
  userId: string;
  isBanned: boolean;
  isAdmin: boolean;
}

export default function UserBanActions({
  userId,
  isBanned,
  isAdmin,
}: UserBanActionsProps) {
  const t = useTranslations("Admin");
  const [isPending, startTransition] = useTransition();

  if (isAdmin) {
    return null;
  }

  function handleBan() {
    if (!confirm(t("confirmBan"))) return;
    startTransition(async () => {
      const result = await banUser(userId);
      if (!result.success) alert(result.error ?? "Failed");
    });
  }

  function handleUnban() {
    if (!confirm(t("confirmUnban"))) return;
    startTransition(async () => {
      const result = await unbanUser(userId);
      if (!result.success) alert(result.error ?? "Failed");
    });
  }

  if (isBanned) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        loading={isPending}
        onClick={handleUnban}
      >
        {t("unban")}
      </Button>
    );
  }

  return (
    <Button
      variant="danger"
      size="sm"
      disabled={isPending}
      loading={isPending}
      onClick={handleBan}
    >
      {t("ban")}
    </Button>
  );
}
