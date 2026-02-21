import { createBrowserClient } from "@supabase/ssr";

// Placeholder values for build-time prerendering (won't make real API calls)
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// Note: Database 型ジェネリックは `supabase gen types typescript` で生成後に適用
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
