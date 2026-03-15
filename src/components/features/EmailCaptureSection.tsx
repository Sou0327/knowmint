"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { subscribeEmail } from "@/app/actions/email-capture";

export default function EmailCaptureSection() {
  const t = useTranslations("EmailCapture");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      const result = await subscribeEmail(email.trim());

      if (result.success) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
        setErrorMsg(result.error);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  return (
    <section className="my-8">
      <div className="dq-window p-6 sm:p-8 text-center">
        <h2 className="font-display text-xl font-bold text-dq-gold mb-2">
          {t("title")}
        </h2>
        <p className="text-dq-text-sub text-sm mb-6">
          {t("description")}
        </p>

        {status === "success" ? (
          <p className="text-dq-cyan font-display">{t("thankYou")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <div className="flex-1">
              <Input
                type="email"
                placeholder={t("placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={status === "error" ? errorMsg : undefined}
                required
                autoComplete="email"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={status === "submitting"}
              className="shrink-0"
            >
              {t("subscribe")}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
