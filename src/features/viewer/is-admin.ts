import type { SupabaseClient } from "@supabase/supabase-js";

// Admin is its own flag since 20261127000100: a row in public.admins (row security lets each
// account read only her own). For clear messages and redirects; the database still checks
// private.is_admin() on every write.
export async function isAdminUser(supabase: Pick<SupabaseClient, "from">, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && Boolean(data);
}
