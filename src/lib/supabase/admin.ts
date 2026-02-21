import { createClient, SupabaseClient } from "@supabase/supabase-js";

const globalForAdmin = globalThis as unknown as {
  __supabaseAdminClient?: SupabaseClient;
};

export function getAdminClient(): SupabaseClient {
  if (globalForAdmin.__supabaseAdminClient) {
    return globalForAdmin.__supabaseAdminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  const client = createClient(url, key);
  globalForAdmin.__supabaseAdminClient = client;
  return client;
}
