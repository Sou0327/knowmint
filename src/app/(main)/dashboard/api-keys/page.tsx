import { getTranslations } from "next-intl/server";
import ApiKeyManager from "@/components/dashboard/ApiKeyManager";

export default async function ApiKeysPage() {
  const t = await getTranslations("ApiKey");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dq-text">
        {t("title")}
      </h1>
      <ApiKeyManager />
    </div>
  );
}
