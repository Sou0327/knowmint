import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/database.types";

export async function getNotifications(
  userId: string,
  limit = 20
): Promise<Notification[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as Notification[]) ?? [];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  return count ?? 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
}

export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}
