import ApiKeyManager from "@/components/dashboard/ApiKeyManager";

export default function ApiKeysPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dq-text">
        APIキー管理
      </h1>
      <ApiKeyManager />
    </div>
  );
}
