"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { subscribeEmail } from "@/app/actions/email-capture";

export default function EmailCaptureSection() {
  const t = useTranslations("EmailCapture");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Progressive enhancement: SSR / hydrate 初期は mode="initial" で style 無し
  // (= visible)。viewport 外で mount した時だけ hidden → observer で visible へ。
  // JS 失敗時も initial のまま表示されるため Subscribe フォームが空白にならない。
  const [mode, setMode] = useState<"initial" | "hidden" | "visible">("initial");
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      // 既に viewport 内 — animation 不要
      return;
    }

    setMode("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMode("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    <section
      ref={sectionRef}
      className="my-8"
      data-animate
      style={
        mode === "hidden"
          ? { opacity: 0 }
          : mode === "visible"
            ? { animation: "animate-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) forwards" }
            : undefined
      }
    >
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
