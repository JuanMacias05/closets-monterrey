import "server-only";

import { createClient } from "@supabase/supabase-js";

// Server-only client with the project's secret key, for the few reads row security must not
// limit: who to notify and their push subscriptions (20261125000100). Never used to act on a
// user's behalf: every mutation goes through her own session first. Null when the key is not
// configured (local dev, or production before the owner adds it); callers then skip the push.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
