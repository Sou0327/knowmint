import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/database.types";

export async function markRead(
  userId: string,
  notificationId: string
): Promise<void> {
  const supabase = await createClient();

  // Ownership check: only mark own notifications as read
  const { data: notification, error: selectError } = await supabase
    .from("notifications")
    .select("id")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) throw new Error("Failed to check notification");
  if (!notification) throw new Error("Notification not found");

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to mark notification as read");
}

export async function getRecentNotifications(
  userId: string,
  limit = 10
): Promise<Notification[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Failed to fetch notifications");
  return (data as Notification[]) ?? [];
}

export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw new Error("Failed to count unread notifications");
  return count ?? 0;
}
