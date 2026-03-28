import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  // Check if user is banned (fail-closed)
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("banned_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.banned_at) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return user;
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const { getAdminClient } = await import("@/lib/supabase/admin");
  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin, banned_at")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin || profile.banned_at) {
    redirect("/");
  }

  return user;
}
