const VALID_DOMAINS = ["finance", "engineering", "marketing", "legal", "medical", "education", "other"] as const;
const VALID_EXPERIENCE_TYPES = ["case_study", "how_to", "template", "checklist", "reference", "other"] as const;
const VALID_SOURCE_TYPES = ["personal_experience", "research", "industry_standard", "other"] as const;
const VALID_APPLICABLE_TO = ["GPT-4", "Claude", "Gemini", "any"] as const;

export type ValidDomain = typeof VALID_DOMAINS[number];
export type ValidExperienceType = typeof VALID_EXPERIENCE_TYPES[number];
export type ValidSourceType = typeof VALID_SOURCE_TYPES[number];
export type ValidApplicableTo = typeof VALID_APPLICABLE_TO[number];

export interface SanitizedMetadata {
  domain?: ValidDomain;
  experience_type?: ValidExperienceType;
  source_type?: ValidSourceType;
  applicable_to?: ValidApplicableTo[];
  // Index signature for Supabase Json compatibility
  [key: string]: string | string[] | undefined;
}

/**
 * metadata JSONB を検証・サニタイズする。
 * 許可外のキー/値は除去し、安全なオブジェクトのみ返す。
 */
export function sanitizeMetadata(raw: unknown): SanitizedMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const result: SanitizedMetadata = {};

  if (typeof input.domain === "string" && (VALID_DOMAINS as ReadonlyArray<string>).includes(input.domain)) {
    result.domain = input.domain as ValidDomain;
  }
  if (typeof input.experience_type === "string" && (VALID_EXPERIENCE_TYPES as ReadonlyArray<string>).includes(input.experience_type)) {
    result.experience_type = input.experience_type as ValidExperienceType;
  }
  if (typeof input.source_type === "string" && (VALID_SOURCE_TYPES as ReadonlyArray<string>).includes(input.source_type)) {
    result.source_type = input.source_type as ValidSourceType;
  }
  if (Array.isArray(input.applicable_to)) {
    const valid = input.applicable_to
      .filter((v): v is ValidApplicableTo => typeof v === "string" && (VALID_APPLICABLE_TO as ReadonlyArray<string>).includes(v))
      .slice(0, 10);
    if (valid.length > 0) result.applicable_to = valid;
  }

  return result;
}
