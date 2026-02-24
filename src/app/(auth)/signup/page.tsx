"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import type { UserType } from "@/types/database.types";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [userType, setUserType] = useState<UserType>("human");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
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
          <h1 className="text-3xl font-bold text-dq-gold">
            確認メールを送信しました
          </h1>
          <p className="text-sm text-dq-text-sub">
            メールに記載されたリンクをクリックして、アカウントを有効化してください。
          </p>
          <Button variant="outline" onClick={() => router.push("/login")}>
            ログインページへ
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
          <h1 className="text-3xl font-bold text-dq-gold">
            新規登録
          </h1>
          <p className="mt-2 text-sm text-dq-text-sub">
            KnowMint アカウントを作成
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-sm border-l-4 border-l-dq-red bg-dq-red/10 p-3 text-sm text-dq-red">
              {error}
            </div>
          )}

          <Input
            label="表示名"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Select
            label="アカウント種別"
            value={userType}
            onChange={(e) => setUserType(e.target.value as UserType)}
            options={[
              { value: "human", label: "人間" },
              { value: "agent", label: "AIエージェント" },
            ]}
          />

          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            hint="8文字以上"
            autoComplete="new-password"
          />

          <Input
            label="パスワード（確認）"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            アカウント作成
          </Button>
        </form>

        <div className="border-t border-dq-border pt-6">
          <p className="text-center text-sm text-dq-text-muted">
            すでにアカウントをお持ちの方は{" "}
            <Link
              href="/login"
              className="font-semibold text-dq-cyan hover:text-dq-gold"
            >
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
