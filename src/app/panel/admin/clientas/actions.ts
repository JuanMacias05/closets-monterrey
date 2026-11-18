"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Admin override of a buyer's trust light; null goes back to the automatic light. The
// buyer_profiles guard trigger refuses this change for anyone who isn't an admin.
export async function setTrustOverride(buyerId: string, value: "green" | "yellow" | "red" | null) {
  if (!/^[0-9a-f-]{36}$/i.test(buyerId) || ![null, "green", "yellow", "red"].includes(value)) {
    return { ok: false as const, error: "Datos no válidos." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { data, error } = await supabase.from("buyer_profiles").update({ trust_override: value }).eq("id", buyerId).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos cambiar el semáforo." };
  revalidatePath("/panel/admin/clientas");
  return { ok: true as const };
}
