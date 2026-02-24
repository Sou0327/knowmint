"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import type { UserType } from "@/types/database.types";

const USER_TYPE_LABELS: Record<UserType, string> = {
  human: "人間",
  agent: "AIエージェント",
};

export default function ProfilePage() {
  const { profile, updateProfile, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
    }
  }, [profile]);

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
      setMessage({ type: "success", text: "プロフィールを更新しました" });
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
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-dq-text">
        プロフィール設定
      </h1>

      <div className="rounded-sm border border-dq-border bg-dq-window-bg p-6">
        {/* Avatar */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-sm bg-dq-surface text-2xl font-bold text-dq-cyan ring-4 ring-dq-border">
            {(displayName || "?")[0].toUpperCase()}
          </div>
          <p className="mt-3 text-sm text-dq-text-muted">
            プロフィール写真
          </p>
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
            label="表示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Input
            label="アカウント種別"
            value={profile ? USER_TYPE_LABELS[profile.user_type ?? "human"] : ""}
            disabled
          />

          <Textarea
            label="自己紹介"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            hint="マークダウンが使えます"
          />

          {/* ウォレットアドレスは SIWS 経由のみ更新可 (読み取り専用表示) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-dq-text-sub">
              ウォレットアドレス (Solana)
            </label>
            {profile?.wallet_address ? (
              <p className="font-mono text-sm text-dq-text-sub">
                {profile.wallet_address}
              </p>
            ) : (
              <p className="text-sm text-dq-text-muted">
                未設定 — ウォレット接続ボタンから設定できます
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" loading={saving} className="mt-2 w-full sm:w-auto">
            保存
          </Button>
        </form>
      </div>
    </div>
  );
}
