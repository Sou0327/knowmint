import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdminClient: SupabaseClient<Database> | undefined;
}
const globalForAdmin = globalThis as typeof globalThis & {
  __supabaseAdminClient?: SupabaseClient<Database>;
};

export function getAdminClient(): SupabaseClient<Database> {
  if (globalForAdmin.__supabaseAdminClient) {
    return globalForAdmin.__supabaseAdminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  const client = createClient<Database>(url, key);
  globalForAdmin.__supabaseAdminClient = client;
  return client;
}
