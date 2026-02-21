const VALID_DOMAINS = ["finance", "engineering", "marketing", "legal", "medical", "education", "other"];
const VALID_EXPERIENCE_TYPES = ["case_study", "how_to", "template", "checklist", "reference", "other"];
const VALID_SOURCE_TYPES = ["personal_experience", "research", "industry_standard", "other"];
const VALID_APPLICABLE_TO = ["GPT-4", "Claude", "Gemini", "any"];

/**
 * metadata JSONB を検証・サニタイズする。
 * 許可外のキー/値は除去し、安全なオブジェクトのみ返す。
 */
export function sanitizeMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if (typeof input.domain === "string" && VALID_DOMAINS.includes(input.domain)) {
    result.domain = input.domain;
  }
  if (typeof input.experience_type === "string" && VALID_EXPERIENCE_TYPES.includes(input.experience_type)) {
    result.experience_type = input.experience_type;
  }
  if (typeof input.source_type === "string" && VALID_SOURCE_TYPES.includes(input.source_type)) {
    result.source_type = input.source_type;
  }
  if (Array.isArray(input.applicable_to)) {
    const valid = input.applicable_to
      .filter((v): v is string => typeof v === "string" && VALID_APPLICABLE_TO.includes(v))
      .slice(0, 10);
    if (valid.length > 0) result.applicable_to = valid;
  }

  return result;
}
