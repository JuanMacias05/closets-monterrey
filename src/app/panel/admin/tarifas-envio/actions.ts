"use server";

import { revalidatePath } from "next/cache";
import { MUNICIPALITIES } from "@/features/couriers/constants";
import { isKnownMunicipality, parseDeliveryFeePesos } from "@/features/delivery/zone-rates";
import { isAdminUser } from "@/features/viewer/is-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Saves every destination from one origin at once: the page edits one origin's table, and a
// whole-table write is what marks those prices as reviewed (updated_by, 20261123000100).
// RLS lets only admins write; the role check here is for a clear message, not the guard.
export async function saveZoneRates(origin: string, fees: Record<string, string>) {
  if (!isKnownMunicipality(origin) || !fees || typeof fees !== "object") {
    return { ok: false as const, error: "Datos no válidos." };
  }
  const rows: { origin_municipality: string; destination_municipality: string; fee_mxn: number }[] = [];
  for (const destination of MUNICIPALITIES) {
    const parsed = parseDeliveryFeePesos(typeof fees[destination] === "string" ? fees[destination] : "");
    if (!parsed.ok) return { ok: false as const, error: `${destination}: ${parsed.error}` };
    rows.push({ origin_municipality: origin, destination_municipality: destination, fee_mxn: parsed.cents });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  if (!(await isAdminUser(supabase, user.id))) {
    return { ok: false as const, error: "Solo la administración puede cambiar las tarifas." };
  }

  const { error } = await supabase.from("delivery_zone_rates").upsert(rows, { onConflict: "origin_municipality,destination_municipality" });
  if (error) return { ok: false as const, error: "No pudimos guardar las tarifas. Inténtalo de nuevo." };

  revalidatePath("/panel/admin/tarifas-envio");
  revalidatePath("/carrito");
  revalidatePath("/");
  return { ok: true as const };
}
