"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Approving a courier is what the "✓ Identidad verificada" badge means: do it only after checking her
// ID in person. The couriers guard trigger refuses this change for non-admins.
export async function setCourierStatus(courierId: string, status: "approved" | "suspended") {
  if (!/^[0-9a-f-]{36}$/i.test(courierId) || !["approved", "suspended"].includes(status)) return { ok: false as const, error: "Datos no válidos." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { data, error } = await supabase.from("couriers").update({ status }).eq("id", courierId).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos cambiar a esa persona." };
  revalidatePath("/panel/admin/recolectoras");
  revalidatePath("/recolectoras");
  revalidatePath("/");
  return { ok: true as const };
}
