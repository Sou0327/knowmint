import { getAdminClient } from "@/lib/supabase/admin";

export interface AuthenticatedUser {
  userId: string;
  keyId: string;
  permissions: string[];
}

// Throttle last_used_at updates: skip if updated within 5 minutes
const lastUpdatedAt = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000;

export async function authenticateApiKey(
  request: Request
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token.startsWith("km_")) return null;

  // SHA-256 hash the raw token
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(token) as BufferSource
  );
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const admin = getAdminClient();

  // Lookup key by hash
  const { data: apiKey, error } = await admin
    .from("api_keys")
    .select("id, user_id, permissions, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !apiKey) return null;

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) return null;

  // Throttled last_used_at update (fire-and-forget)
  const now = Date.now();
  const lastUpdate = lastUpdatedAt.get(apiKey.id);
  if (!lastUpdate || now - lastUpdate > THROTTLE_MS) {
    lastUpdatedAt.set(apiKey.id, now);
    admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKey.id)
      .then(() => {}, () => {});
  }

  return {
    userId: apiKey.user_id,
    keyId: apiKey.id,
    permissions: apiKey.permissions ?? [],
  };
}

// Generate a new API key. Returns the raw key (to show once) and the hash (to store).
export async function generateApiKey(): Promise<{ raw: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw =
    "km_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(raw) as BufferSource
  );
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { raw, hash };
}
