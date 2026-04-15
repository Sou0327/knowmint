"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { revokeApiKey } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface ApiKeyActionsProps {
  keyId: string;
}

export default function ApiKeyActions({ keyId }: ApiKeyActionsProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const runRevoke = () => {
    startTransition(async () => {
      const result = await revokeApiKey(keyId);
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
        {t("revoke")}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={t("confirmRevokeTitle")}
        description={t("confirmRevoke")}
        confirmLabel={t("revoke")}
        cancelLabel={tCommon("cancel")}
        variant="danger"
        pending={isPending}
        onConfirm={runRevoke}
        onCancel={() => {
          if (!isPending) setConfirming(false);
        }}
      />
    </>
  );
}
