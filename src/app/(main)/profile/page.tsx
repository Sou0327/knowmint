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
  const [walletAddress, setWalletAddress] = useState("");
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
      setWalletAddress(profile.wallet_address || "");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await updateProfile({
      display_name: displayName,
      bio,
      wallet_address: walletAddress || null,
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        プロフィール設定
      </h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {/* Avatar */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 text-2xl font-bold text-blue-600 ring-4 ring-blue-50 dark:from-blue-900 dark:to-violet-900 dark:text-blue-300 dark:ring-blue-950">
            {(displayName || "?")[0].toUpperCase()}
          </div>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            プロフィール写真
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div
              className={`rounded-lg border-l-4 p-3 text-sm ${
                message.type === "success"
                  ? "border-l-green-500 bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
                  : "border-l-red-500 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
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

          <Input
            label="ウォレットアドレス (Solana)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            hint="売上の受取先アドレス"
            className="font-mono"
          />

          <Button type="submit" variant="primary" loading={saving} className="mt-2 w-full sm:w-auto">
            保存
          </Button>
        </form>
      </div>
    </div>
  );
}
