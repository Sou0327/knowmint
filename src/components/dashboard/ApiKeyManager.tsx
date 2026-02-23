"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import type { ApiKey } from "@/types/database.types";
import { PERMISSION_OPTIONS } from "@/lib/api/permissions";

type ApiKeyListItem = Omit<ApiKey, "key_hash" | "user_id">;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["read"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyListItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/v1/keys", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json()) as ApiResponse<ApiKeyListItem[]>;
      if (!res.ok || !json.success) {
        setKeys([]);
        setErrorMessage(json.error?.message || "APIキーの取得に失敗しました");
        return;
      }

      setKeys(json.data ?? []);
    } catch {
      setKeys([]);
      setErrorMessage("APIキーの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    setCreating(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permissions: newKeyPermissions,
        }),
      });

      const json = (await res.json()) as ApiResponse<{
        id: string;
        name: string;
        key: string;
        permissions: string[];
        created_at: string;
        expires_at: string | null;
      }>;

      if (!res.ok || !json.success || !json.data) {
        setErrorMessage(json.error?.message || "APIキーの作成に失敗しました");
        return;
      }

      setCreatedKey(json.data.key);
      setNewKeyName("");
      setNewKeyPermissions(["read"]);
      setShowCreate(false);
      await fetchKeys();
    } catch {
      setErrorMessage("APIキーの作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key_id: deleteTarget.id }),
      });

      const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || "APIキーの削除に失敗しました");
        return;
      }

      setDeleteTarget(null);
      await fetchKeys();
    } catch {
      setErrorMessage("APIキーの削除に失敗しました");
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePermission = (perm: string) => {
    setNewKeyPermissions((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {errorMessage && (
        <Card padding="md" className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
          <p className="text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </p>
        </Card>
      )}

      {/* Created Key Display */}
      {createdKey && (
        <Card padding="md" className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                APIキーが作成されました。このキーは一度だけ表示されます。
              </p>
              <code className="mt-2 block break-all rounded-lg bg-green-100 px-3 py-2.5 font-mono text-sm text-green-900 dark:bg-green-900 dark:text-green-100">
                {createdKey}
              </code>
            </div>
            <div className="ml-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(createdKey)}
              >
                {copied ? "コピー済み" : "コピー"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatedKey(null)}
              >
                閉じる
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Create Form */}
      {showCreate ? (
        <Card padding="md" className="mb-6">
          <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            新しいAPIキーを作成
          </h3>
          <div className="space-y-4">
            <Input
              label="キー名"
              placeholder="例: 本番環境用"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                権限
              </p>
              <div className="space-y-2">
                {PERMISSION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={newKeyPermissions.includes(opt.value)}
                      onChange={() => togglePermission(opt.value)}
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {opt.label}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {opt.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleCreate}
                loading={creating}
                disabled={!newKeyName.trim() || newKeyPermissions.length === 0}
              >
                作成
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          variant="primary"
          onClick={() => setShowCreate(true)}
          className="mb-6"
        >
          新しいAPIキーを作成
        </Button>
      )}

      {/* Key List */}
      {keys.length === 0 ? (
        <Card padding="lg">
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            APIキーがありません
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <Card key={key.id} padding="md">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {key.name}
                    </p>
                    {key.permissions.map((p) => (
                      <Badge key={p} variant="info">
                        {p}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      作成: {new Date(key.created_at).toLocaleDateString("ja-JP")}
                    </span>
                    {key.last_used_at && (
                      <span>
                        最終使用: {new Date(key.last_used_at).toLocaleDateString("ja-JP")}
                      </span>
                    )}
                    {key.expires_at && (
                      <span>
                        有効期限: {new Date(key.expires_at).toLocaleDateString("ja-JP")}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTarget(key)}
                >
                  削除
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Usage Guide */}
      <Card padding="md" className="mt-8">
        <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          APIキーの使い方
        </h3>
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            APIキーを使用して、KnowMint API にプログラムからアクセスできます。
          </p>
          <code className="block rounded-lg bg-zinc-100 px-3 py-2.5 font-mono text-xs leading-relaxed dark:bg-zinc-800">
            {`curl -H "Authorization: Bearer km_your_key_here" \\`}
            <br />
            {`  ${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/v1/knowledge`}
          </code>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            APIキーは安全に管理してください。キーが漏洩した場合は直ちに削除し、新しいキーを作成してください。
          </p>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="APIキーの削除"
        size="sm"
      >
        <p className="mb-4 text-zinc-600 dark:text-zinc-400">
          <strong className="text-zinc-900 dark:text-zinc-100">
            {deleteTarget?.name}
          </strong>{" "}
          を削除しますか？この操作は取り消せません。
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            キャンセル
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            削除する
          </Button>
        </div>
      </Modal>
    </div>
  );
}
