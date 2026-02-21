import ApiKeyManager from "@/components/dashboard/ApiKeyManager";

export default function ApiKeysPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        APIキー管理
      </h1>
      <ApiKeyManager />
    </div>
  );
}
