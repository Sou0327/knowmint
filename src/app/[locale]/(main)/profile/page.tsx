"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  AVATAR_BUCKET,
  buildAvatarPublicUrl,
  validateAvatarFile,
} from "@/lib/storage/avatars";
import type { UserType } from "@/types/database.types";

export default function ProfilePage() {
  const t = useTranslations("Profile");
  const tCommon = useTranslations("Common");
  const USER_TYPE_LABELS: Record<UserType, string> = {
    human: t("userTypeHuman"),
    agent: t("userTypeAgent"),
  };
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setMessage({ type: "error", text: t(validationError) });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAvatarUploading(true);
    setMessage(null);

    try {
      const storagePath = `${user.id}/avatar`;
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (error) {
        setMessage({ type: "error", text: t("uploadFailed") });
        return;
      }

      const avatarUrl = `${buildAvatarPublicUrl(user.id)}?t=${Date.now()}`;
      const { error: profileError } = await updateProfile({ avatar_url: avatarUrl });

      if (profileError) {
        // Retry once — the file is already uploaded and the old cache-bust
        // URL would cause CDN to serve the stale cached version
        const { error: retryError } = await updateProfile({ avatar_url: avatarUrl });
        if (retryError) {
          setMessage({ type: "error", text: retryError });
        }
      }
    } catch {
      setMessage({ type: "error", text: t("uploadFailed") });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    if (!user) return;
    setAvatarUploading(true);
    setMessage(null);

    try {
      // Update DB first to maintain consistency — orphan files are acceptable
      const { error } = await updateProfile({ avatar_url: null });
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }

      // Storage cleanup — DB reference is already removed, so orphan is non-critical
      const { error: removeError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([`${user.id}/avatar`]);

      if (removeError) {
        // DB avatar_url is already null — avatar won't display.
        // Storage orphan will be cleaned up eventually.
        console.warn("[avatar] storage cleanup failed:", removeError.message);
      }
      setMessage({ type: "success", text: t("avatarRemoved") });
    } catch {
      setMessage({ type: "error", text: t("uploadFailed") });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await updateProfile({
      display_name: displayName,
      bio,
    });

    if (error) {
      setMessage({ type: "error", text: error });
    } else {
      setMessage({ type: "success", text: t("updated") });
    }
    setSaving(false);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-dq-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold font-display tracking-tight text-dq-text">
        {t("title")}
      </h1>

      <div className="rounded-sm border border-dq-border bg-dq-window-bg p-6">
        {/* Avatar Upload */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative">
            <UserAvatar
              userId={user?.id ?? ""}
              displayName={displayName}
              avatarUrl={profile?.avatar_url ?? null}
              size="lg"
              className={avatarUploading ? "opacity-50" : ""}
            />
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-dq-gold border-t-transparent" />
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="text-sm text-dq-cyan hover:text-dq-gold transition-colors disabled:opacity-50"
            >
              {avatarUploading ? t("avatarUploading") : t("uploadAvatar")}
            </button>
            {profile?.avatar_url && (
              <>
                <span className="text-dq-text-muted">|</span>
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarUploading}
                  className="text-sm text-dq-red hover:text-dq-red/80 transition-colors disabled:opacity-50"
                >
                  {t("removeAvatar")}
                </button>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div
              className={`rounded-sm border-l-4 p-3 text-sm ${
                message.type === "success"
                  ? "border-l-dq-green bg-dq-green/10 text-dq-green"
                  : "border-l-dq-red bg-dq-red/10 text-dq-red"
              }`}
            >
              {message.text}
            </div>
          )}

          <Input
            label={t("displayName")}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Input
            label={t("accountType")}
            value={profile ? USER_TYPE_LABELS[profile.user_type ?? "human"] : ""}
            disabled
          />

          <Textarea
            label={t("bio")}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            hint={t("markdownSupported")}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-dq-text-sub">
              {t("walletAddress")}
            </label>
            {profile?.wallet_address ? (
              <div className="flex items-center gap-2">
                <p className="truncate font-mono text-sm text-dq-text-sub">
                  {profile.wallet_address}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(profile.wallet_address!);
                    setMessage({ type: "success", text: t("copied") });
                    setTimeout(() => setMessage(null), 2000);
                  }}
                  className="shrink-0 rounded-sm p-1.5 text-dq-text-muted transition-colors hover:bg-dq-surface hover:text-dq-cyan"
                  aria-label={t("copyAddress")}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-sm text-dq-text-muted">
                {t("walletNotSet")}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-dq-text-sub">
              {t("trustScore")}
            </label>
            {profile?.trust_score != null ? (
              <div className="flex items-center gap-2">
                {profile.trust_score >= 0.5 && (
                  <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-bold ${
                    profile.trust_score >= 0.8
                      ? "bg-dq-green/20 text-dq-green"
                      : "bg-dq-gold/20 text-dq-gold"
                  }`}>
                    {profile.trust_score >= 0.8 ? t("trustHigh") : t("trust")}
                  </span>
                )}
                <span className="text-sm text-dq-text-sub">
                  {Math.round(profile.trust_score * 100)}%
                </span>
              </div>
            ) : (
              <p className="text-sm text-dq-text-muted">
                {t("trustScoreNone")}
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" loading={saving} className="mt-2 w-full sm:w-auto">
            {tCommon("save")}
          </Button>
        </form>
      </div>
    </div>
  );
}
