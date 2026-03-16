"use client";

import { useState } from "react";
import { buildAvatarPublicUrl } from "@/lib/storage/avatars";

interface UserAvatarProps {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  size: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { container: "h-8 w-8", text: "text-xs" },
  md: { container: "h-12 w-12", text: "text-base" },
  lg: { container: "h-20 w-20", text: "text-2xl" },
} as const;

/**
 * Extract only the whitelisted `t` cache-bust parameter from avatar_url.
 * All other query params are discarded to prevent injection.
 */
function extractCacheBust(avatarUrl: string): string {
  try {
    const url = new URL(avatarUrl);
    const t = url.searchParams.get("t");
    return t ? `?t=${encodeURIComponent(t)}` : "";
  } catch {
    return "";
  }
}

export default function UserAvatar({
  userId,
  displayName,
  avatarUrl,
  size,
  className = "",
}: UserAvatarProps) {
  // Track which URL failed so we auto-retry when avatarUrl changes (no useEffect needed)
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { container, text } = sizeMap[size];
  const initial = (displayName || "?")[0].toUpperCase();

  // Derive the trusted URL from userId — never trust the stored URL directly
  const safeUrl = avatarUrl
    ? buildAvatarPublicUrl(userId) + extractCacheBust(avatarUrl)
    : null;

  if (safeUrl && safeUrl !== failedUrl) {
    return (
      <img
        src={safeUrl}
        alt={displayName || ""}
        loading="lazy"
        onError={() => setFailedUrl(safeUrl)}
        className={`${container} shrink-0 rounded-sm border-2 border-dq-border object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex ${container} shrink-0 items-center justify-center rounded-sm bg-dq-surface ${text} font-bold text-dq-cyan border-2 border-dq-border ${className}`}
    >
      {initial}
    </div>
  );
}
