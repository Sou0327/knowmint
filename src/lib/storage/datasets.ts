import type { SupabaseClient } from "@supabase/supabase-js";

export const DATASET_BUCKET = "knowledge-datasets";
export const DATASET_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const DATASET_ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "application/json",
  "application/x-ndjson",
  "application/octet-stream",
];

function getSupabaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  return configured.startsWith("http://")
    ? configured.replace(/^http:\/\//, "https://")
    : configured;
}

function trimSlashes(input: string): string {
  return input.replace(/^\/+|\/+$/g, "");
}

export function sanitizeDatasetFilename(filename: string): string {
  const lastSegment = filename.split("/").pop()?.split("\\").pop() || "dataset.bin";
  const sanitized = lastSegment.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized : "dataset.bin";
}

export function normalizeDatasetStoragePath(path: string): string {
  return trimSlashes(path);
}

export function buildDatasetFileUrl(storagePath: string): string {
  const base = getSupabaseUrl().replace(/\/+$/, "");
  const normalized = normalizeDatasetStoragePath(storagePath);
  const encodedPath = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/private/${DATASET_BUCKET}/${encodedPath}`;
}

export function extractDatasetStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  try {
    const parsed = new URL(fileUrl);
    const marker = `/storage/v1/object/private/${DATASET_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    const encoded = parsed.pathname.slice(idx + marker.length);
    if (!encoded) return null;
    return encoded
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

export async function ensureDatasetBucket(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.storage.createBucket(DATASET_BUCKET, {
    public: false,
    fileSizeLimit: DATASET_MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: DATASET_ALLOWED_MIME_TYPES,
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message || "Failed to ensure dataset bucket");
  }
}

export async function createDatasetSignedDownloadUrl(
  admin: SupabaseClient,
  fileUrl: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const storagePath = extractDatasetStoragePath(fileUrl);
  if (!storagePath) return null;

  const { data, error } = await admin
    .storage
    .from(DATASET_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
