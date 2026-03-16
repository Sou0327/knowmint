export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const AVATAR_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function getSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co").replace(
    /\/+$/,
    ""
  );
}

/**
 * Build the public URL for a user's avatar.
 * Supabase public bucket URL pattern: {base}/storage/v1/object/public/{bucket}/{path}
 */
export function buildAvatarPublicUrl(userId: string): string {
  const base = getSupabaseUrl();
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${encodeURIComponent(userId)}/avatar`;
}

/**
 * Validate a file before upload.
 * Returns an i18n key string on error, or null if valid.
 */
export function validateAvatarFile(file: File): string | null {
  if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) return "fileTooLarge";
  if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.type)) return "invalidFileType";
  return null;
}
