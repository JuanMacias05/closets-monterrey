"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The first time a seller shares her own store, the checklist's "Comparte tu bazar" is done.
// Row security limits the update to her own private settings.
export async function markStoreShared(): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("seller_private_settings")
    .update({ store_shared_at: new Date().toISOString() }).eq("seller_id", user.id).is("store_shared_at", null);
  if (error) return { ok: false };
  revalidatePath("/panel");
  return { ok: true };
}
