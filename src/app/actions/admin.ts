"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/log";
import { UUID_RE } from "@/lib/api/validation";

/** Revalidate admin pages for all locales */
function revalidateAdmin() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ja/admin", "layout");
}

// --- User Management ---

export async function banUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(userId)) return { success: false, error: "Invalid user ID" };

  const admin = await requireAdmin();
  const client = getAdminClient();

  // Prevent banning yourself
  if (userId === admin.id) {
    return { success: false, error: "Cannot ban yourself" };
  }

  // Atomic: only update non-admin users
  const { data: updated, error } = await client
    .from("profiles")
    .update({ banned_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("is_admin", false)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: "User not found or is an admin" };

  after(() => logAuditEvent({
    userId: admin.id,
    action: "admin.user_banned",
    resourceType: "profile",
    resourceId: userId,
  }));

  revalidateAdmin();
  return { success: true };
}

export async function unbanUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(userId)) return { success: false, error: "Invalid user ID" };

  const admin = await requireAdmin();
  const client = getAdminClient();

  const { data: updated, error } = await client
    .from("profiles")
    .update({ banned_at: null })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: "User not found" };

  after(() => logAuditEvent({
    userId: admin.id,
    action: "admin.user_unbanned",
    resourceType: "profile",
    resourceId: userId,
  }));

  revalidateAdmin();
  return { success: true };
}

// --- Report Management ---

export async function reviewReport(
  reportId: string,
  action: "resolve" | "dismiss" | "start_review",
  options?: { reviewer_note?: string; remove_item?: boolean }
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(reportId))
    return { success: false, error: "Invalid report ID" };

  const admin = await requireAdmin();
  const client = getAdminClient();

  const newStatus =
    action === "resolve"
      ? "resolved"
      : action === "dismiss"
        ? "dismissed"
        : "reviewing";

  const { error } = await client.rpc("admin_review_report", {
    p_report_id: reportId,
    p_new_status: newStatus,
    p_reviewer_id: admin.id,
    p_reviewer_note: options?.reviewer_note ?? "",
    p_remove_item: action === "resolve" && options?.remove_item === true,
  });

  if (error) return { success: false, error: error.message };

  after(() => logAuditEvent({
    userId: admin.id,
    action: "report.reviewed",
    resourceType: "knowledge_item_report",
    resourceId: reportId,
    metadata: {
      action,
      remove_item: options?.remove_item ?? false,
    },
  }));

  revalidateAdmin();
  return { success: true };
}

// --- Listing Management ---

export async function suspendListing(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(itemId))
    return { success: false, error: "Invalid item ID" };

  const admin = await requireAdmin();
  const client = getAdminClient();

  const { data: updated, error } = await client
    .from("knowledge_items")
    .update({ status: "suspended", moderation_status: "removed" })
    .eq("id", itemId)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: "Listing not found" };

  after(() => logAuditEvent({
    userId: admin.id,
    action: "admin.listing_suspended",
    resourceType: "knowledge_item",
    resourceId: itemId,
  }));

  revalidateAdmin();
  return { success: true };
}

// --- API Key Management ---

export async function revokeApiKey(
  keyId: string
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(keyId))
    return { success: false, error: "Invalid key ID" };

  const admin = await requireAdmin();
  const client = getAdminClient();

  const { data: deleted, error } = await client
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!deleted) return { success: false, error: "API key not found" };

  after(() => logAuditEvent({
    userId: admin.id,
    action: "admin.apikey_revoked",
    resourceType: "api_key",
    resourceId: keyId,
  }));

  revalidateAdmin();
  return { success: true };
}
