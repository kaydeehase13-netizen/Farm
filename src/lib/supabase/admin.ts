import { createClient } from "@supabase/supabase-js";

// Server-only, service-role Supabase client. Bypasses RLS — use ONLY for
// operations that must cross tenant boundaries by design (inviting a new
// user, admin tooling). Never import this from a Client Component; the
// service role key must never reach the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
