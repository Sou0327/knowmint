"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { revokeApiKey } from "@/app/actions/admin";
import Button from "@/components/ui/Button";

interface ApiKeyActionsProps {
  keyId: string;
}

export default function ApiKeyActions({ keyId }: ApiKeyActionsProps) {
  const t = useTranslations("Admin");
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    if (!confirm(t("confirmRevoke"))) return;
    startTransition(async () => {
      const result = await revokeApiKey(keyId);
      if (!result.success) alert(result.error ?? "Failed");
    });
  }

  return (
    <Button
      variant="danger"
      size="sm"
      disabled={isPending}
      onClick={handleRevoke}
    >
      {isPending ? "..." : t("revoke")}
    </Button>
  );
}
