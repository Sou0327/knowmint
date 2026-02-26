"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
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
  const t = useTranslations("ApiKey");
  const tCommon = useTranslations("Common");
  const tTypes = useTranslations("Types");
  const locale = useLocale();

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

  const dateLocale = locale === "ja" ? "ja-JP" : "en-US";

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
        setErrorMessage(json.error?.message || t("fetchFailed"));
        return;
      }

      setKeys(json.data ?? []);
    } catch {
      setKeys([]);
      setErrorMessage(t("fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        setErrorMessage(json.error?.message || t("createFailed"));
        return;
      }

      setCreatedKey(json.data.key);
      setNewKeyName("");
      setNewKeyPermissions(["read"]);
      setShowCreate(false);
      await fetchKeys();
    } catch {
      setErrorMessage(t("createFailed"));
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
        setErrorMessage(json.error?.message || t("deleteFailed"));
        return;
      }

      setDeleteTarget(null);
      await fetchKeys();
    } catch {
      setErrorMessage(t("deleteFailed"));
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
        <span className="text-dq-gold dq-cursor text-2xl">▶▶▶</span>
      </div>
    );
  }

  return (
    <div>
      {errorMessage && (
        <Card padding="md" className="mb-6 !border-dq-red">
          <p className="text-sm text-dq-red">
            {errorMessage}
          </p>
        </Card>
      )}

      {/* Created Key Display */}
      {createdKey && (
        <Card padding="md" className="mb-6 !border-dq-green">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-dq-green">
                {t("keyCreated")}
              </p>
              <code className="mt-2 block break-all rounded-sm bg-dq-surface px-3 py-2.5 font-mono text-sm text-dq-cyan border border-dq-border">
                {createdKey}
              </code>
            </div>
            <div className="ml-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(createdKey)}
              >
                {copied ? tCommon("copied") : tCommon("copy")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatedKey(null)}
              >
                {tCommon("close")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Create Form */}
      {showCreate ? (
        <Card padding="md" className="mb-6">
          <h3 className="mb-4 text-lg font-semibold text-dq-gold">
            {t("createNew")}
          </h3>
          <div className="space-y-4">
            <Input
              label={t("keyName")}
              placeholder={t("keyNamePlaceholder")}
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-dq-text-sub">
                {t("permissions")}
              </p>
              <div className="space-y-2">
                {PERMISSION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-sm border-2 border-dq-border p-3 hover:bg-dq-surface transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={newKeyPermissions.includes(opt.value)}
                      onChange={() => togglePermission(opt.value)}
                      className="h-4 w-4 rounded-sm border-dq-border accent-dq-gold"
                    />
                    <div>
                      <p className="text-sm font-medium text-dq-text">
                        {tTypes(`permission.${opt.value}`)}
                      </p>
                      <p className="text-xs text-dq-text-muted">
                        {tTypes(`permission.${opt.value}Desc`)}
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
                {tCommon("create")}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                {tCommon("cancel")}
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
          {t("createNew")}
        </Button>
      )}

      {/* Key List */}
      {keys.length === 0 ? (
        <Card padding="lg">
          <p className="text-center text-dq-text-muted">
            {t("noKeys")}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <Card key={key.id} padding="md">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-dq-text">
                      {key.name}
                    </p>
                    {key.permissions.map((p) => (
                      <Badge key={p} variant="info">
                        {p}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-dq-text-muted">
                    <span>
                      {t("created")} {new Date(key.created_at).toLocaleDateString(dateLocale)}
                    </span>
                    {key.last_used_at && (
                      <span>
                        {t("lastUsed")} {new Date(key.last_used_at).toLocaleDateString(dateLocale)}
                      </span>
                    )}
                    {key.expires_at && (
                      <span>
                        {t("expires")} {new Date(key.expires_at).toLocaleDateString(dateLocale)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTarget(key)}
                >
                  {tCommon("delete")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Usage Guide */}
      <Card padding="md" className="mt-8">
        <h3 className="mb-3 text-lg font-semibold text-dq-gold">
          {t("howToUse")}
        </h3>
        <div className="space-y-2 text-sm text-dq-text-sub">
          <p>
            {t("howToUseDesc")}
          </p>
          <code className="block rounded-sm bg-dq-surface px-3 py-2.5 font-mono text-xs leading-relaxed text-dq-cyan border border-dq-border">
            {`curl -H "Authorization: Bearer km_your_key_here" \\`}
            <br />
            {`  ${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/v1/knowledge`}
          </code>
          <p className="text-xs text-dq-text-muted">
            {t("securityNote")}
          </p>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("deleteTitle")}
        size="sm"
      >
        <p className="mb-4 text-dq-text-sub">
          <strong className="text-dq-text">
            {deleteTarget?.name}
          </strong>{" "}
          {t("deleteConfirm")}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            {tCommon("cancel")}
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            {tCommon("delete")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
