"use server";

import { requireAuth } from "@/lib/auth/session";
import { toggleFavorite } from "@/lib/favorites/service";
import { toggleFollow } from "@/lib/follows/service";
import {
  markRead,
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/notifications/service";
import type { Notification } from "@/types/database.types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- Favorites ---

export async function toggleFavoriteAction(
  itemId: string
): Promise<{ favorited: boolean; error?: string }> {
  if (!UUID_RE.test(itemId)) {
    return { favorited: false, error: "Invalid item ID" };
  }

  const user = await requireAuth();

  try {
    const result = await toggleFavorite(user.id, itemId);
    return result;
  } catch {
    return { favorited: false, error: "Failed to toggle favorite" };
  }
}

// --- Follows ---

export async function toggleFollowAction(
  targetUserId: string
): Promise<{ following: boolean; error?: string }> {
  if (!UUID_RE.test(targetUserId)) {
    return { following: false, error: "Invalid user ID" };
  }

  const user = await requireAuth();

  try {
    const result = await toggleFollow(user.id, targetUserId);
    return result;
  } catch {
    return { following: false, error: "Failed to toggle follow" };
  }
}

// --- Notifications ---

export async function markNotificationReadAction(
  notificationId: string
): Promise<{ error?: string }> {
  if (!UUID_RE.test(notificationId)) {
    return { error: "Invalid notification ID" };
  }

  const user = await requireAuth();

  try {
    await markRead(user.id, notificationId);
    return {};
  } catch {
    return { error: "Failed to mark as read" };
  }
}

export async function fetchNotificationsAction(): Promise<{
  notifications: Notification[];
  error?: string;
}> {
  const user = await requireAuth();

  try {
    const notifications = await getRecentNotifications(user.id);
    return { notifications };
  } catch {
    return { notifications: [], error: "Failed to fetch notifications" };
  }
}

export async function fetchUnreadCountAction(): Promise<{ count: number }> {
  const user = await requireAuth();

  try {
    const count = await getUnreadNotificationCount(user.id);
    return { count };
  } catch {
    return { count: 0 };
  }
}
