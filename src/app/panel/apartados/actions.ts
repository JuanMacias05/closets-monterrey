"use server";

import { revalidatePath } from "next/cache";
import { parseDeliveryFeePesos } from "@/features/delivery/zone-rates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SellerReservationAction = "confirm" | "on_the_way" | "cancel" | "no_show";

// Thin wrapper over update_reservation: the database function checks the caller is the
// reservation's seller (or an admin) and that the transition is allowed.
export async function updateSellerReservation(reservationId: string, action: SellerReservationAction) {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId) || !["confirm", "on_the_way", "cancel", "no_show"].includes(action)) {
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

// Delivery is proven by the 4-digit PIN only the buyer can see; the seller types what the
// buyer tells her at hand-off.
export async function completeWithPin(reservationId: string, pin: string) {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId) || !/^\d{4}$/.test(pin)) {
    return { ok: false as const, error: "El código de entrega tiene 4 dígitos." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("complete_reservation_with_pin", { target: reservationId, pin });
  if (error) {
    return { ok: false as const, error: error.message.includes("wrong_pin") ? "Ese código no coincide. Pídeselo de nuevo a tu cliente." : "No se pudo marcar como entregada; recarga la página." };
  }
  revalidatePath("/panel/apartados");
  revalidatePath("/panel/prendas");
  revalidatePath("/");
  return { ok: true as const };
}

export async function rejectDepositProof(reservationId: string, reason: string) {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(reservationId) || text.length < 3 || text.length > 160) {
    return { ok: false as const, error: "Escribe el motivo (de 3 a 160 caracteres)." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("reject_deposit_proof", { target: reservationId, reason: text });
  if (error) return { ok: false as const, error: "No se pudo rechazar; recarga la página e inténtalo de nuevo." };
  revalidatePath("/panel/apartados");
  revalidatePath("/cuenta");
  return { ok: true as const };
}

const ADJUST_ERRORS: Record<string, string> = {
  not_pending: "Este apartado ya no está esperando anticipo; el envío ya no se puede cambiar.",
  deposit_sent: "Tu cliente ya te mandó su anticipo, así que el envío se queda como lo vio.",
  fee_unchanged: "Ese ya es el costo del envío.",
  not_home_delivery: "Solo se ajusta el envío a domicilio.",
};

// The rate table gives an estimate; the seller fixes it for an address that is far away.
// adjust_delivery_fee checks she is the reservation's seller, that the buyer hasn't sent her
// deposit yet, and the bounds again.
export async function adjustDeliveryFee(reservationId: string, pesos: string) {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return { ok: false as const, error: "Datos no válidos." };
  const fee = parseDeliveryFeePesos(pesos);
  if (!fee.ok) return { ok: false as const, error: fee.error };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("adjust_delivery_fee", { target: reservationId, new_fee: fee.cents });
  if (error) {
    const code = Object.keys(ADJUST_ERRORS).find((key) => error.message.includes(key));
    return { ok: false as const, error: code ? ADJUST_ERRORS[code]! : "No se pudo cambiar el envío; recarga la página e inténtalo de nuevo." };
  }
  revalidatePath("/panel/apartados");
  revalidatePath("/cuenta");
  return { ok: true as const };
}
