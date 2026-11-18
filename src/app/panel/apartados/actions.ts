"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SellerReservationAction = "confirm" | "complete" | "cancel" | "no_show";

// Thin wrapper over update_reservation: the database function checks the caller is the
// reservation's seller (or an admin) and that the transition is allowed.
export async function updateSellerReservation(reservationId: string, action: SellerReservationAction) {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId) || !["confirm", "complete", "cancel", "no_show"].includes(action)) {
    return { ok: false as const, error: "Datos no válidos." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("update_reservation", { target: reservationId, action });
  if (error) return { ok: false as const, error: "No se pudo hacer ese cambio; recarga la página e inténtalo de nuevo." };
  revalidatePath("/panel/apartados");
  revalidatePath("/panel/prendas");
  revalidatePath("/");
  return { ok: true as const };
}
