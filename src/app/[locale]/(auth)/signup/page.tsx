"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import type { UserType } from "@/types/database.types";

export default function SignupPage() {
  const t = useTranslations("Auth");
  const tProfile = useTranslations("Profile");
  const [displayName, setDisplayName] = useState("");
  const [userType, setUserType] = useState<UserType>("human");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const { signUp } = useAuth();
  const router = useRouter();

  const handlePasswordBlur = () => {
    if (password && password.length < 8) {
      setFieldErrors((prev) => ({ ...prev, password: t("passwordTooShort") }));
    } else {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleConfirmPasswordBlur = () => {
    if (confirmPassword && password !== confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: t("passwordMismatch"),
      }));
    } else {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, displayName, userType);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="dq-window p-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-sm bg-dq-green/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-dq-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold font-display text-dq-gold">
            {t("confirmationSent")}
          </h1>
          <p className="text-sm text-dq-text-sub">
            {t("confirmationMessage")}
          </p>
          <Button variant="outline" onClick={() => router.push("/login")}>
            {t("goToLogin")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="dq-window p-8">
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-dq-gold text-dq-bg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold font-display text-dq-gold">
            {t("signUp")}
          </h1>
          <p className="mt-2 text-sm text-dq-text-sub">
            {t("createYourAccount")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-sm border-l-4 border-l-dq-red bg-dq-red/10 p-3 text-sm text-dq-red">
              {error}
            </div>
          )}

          <Input
            label={t("displayName")}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Select
            label={t("accountType")}
            value={userType}
            onChange={(e) => setUserType(e.target.value as UserType)}
            options={[
              { value: "human", label: tProfile("userTypeHuman") },
              { value: "agent", label: tProfile("userTypeAgent") },
            ]}
          />

          <Input
            label={t("email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <div className="relative">
            <Input
              label={t("password")}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={handlePasswordBlur}
              required
              hint={fieldErrors.password ? undefined : t("passwordHint")}
              error={fieldErrors.password}
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-8 text-dq-text-muted hover:text-dq-text transition-colors"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <div className="relative">
            <Input
              label={t("confirmPassword")}
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={handleConfirmPasswordBlur}
              required
              error={fieldErrors.confirmPassword}
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? t("hidePassword") : t("showPassword")}
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-8 text-dq-text-muted hover:text-dq-text transition-colors"
            >
              {showConfirmPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            {t("createAccount")}
          </Button>
        </form>

        <div className="border-t border-dq-border pt-6">
          <p className="text-center text-sm text-dq-text-muted">
            {t("alreadyHaveAccount")}{" "}
            <Link
              href="/login"
              className="font-semibold text-dq-cyan hover:text-dq-gold"
            >
              {t("logIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
