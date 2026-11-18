"use server";

import { revalidatePath } from "next/cache";
import { MUNICIPALITIES } from "@/features/couriers/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

type CourierProfileInput = { municipalities: string[]; days: number[]; timeWindow: string; fee: string; pointIds: string[] };

export async function saveCourierProfile(input: CourierProfileInput) {
  if (!input || !Array.isArray(input.municipalities) || !Array.isArray(input.days) || !Array.isArray(input.pointIds)
    || input.municipalities.some((m) => !(MUNICIPALITIES as readonly string[]).includes(m))
    || input.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    || input.pointIds.some((id) => typeof id !== "string" || !UUID.test(id))
    || typeof input.timeWindow !== "string" || typeof input.fee !== "string") {
    return { ok: false as const, error: "Revisa tus datos de ruta." };
  }
  const fee = Number(input.fee.trim() || "0");
  if (!Number.isFinite(fee) || fee < 0 || fee > 1000) return { ok: false as const, error: "La tarifa debe estar entre $0 y $1,000." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión." };

  const { error } = await supabase.from("couriers").update({
    municipalities: [...new Set(input.municipalities)],
    days: [...new Set(input.days)].toSorted(),
    time_window: input.timeWindow.trim().slice(0, 60) || null,
    fee_mxn: Math.round(fee * 100),
  }).eq("id", user.id);
  if (error) return { ok: false as const, error: "No pudimos guardar tu ruta." };

  // Replace the whole set: a courier has a handful of points.
  const { error: clearError } = await supabase.from("courier_pickup_points").delete().eq("courier_id", user.id);
  const ids = [...new Set(input.pointIds)];
  const { error: insertError } = clearError || ids.length === 0
    ? { error: clearError }
    : await supabase.from("courier_pickup_points").insert(ids.map((pointId) => ({ courier_id: user.id, point_id: pointId })));
  if (clearError || insertError) return { ok: false as const, error: "No pudimos guardar tus puntos de recolección." };

  revalidatePath("/recolectora");
  revalidatePath("/recolectoras");
  return { ok: true as const };
}

export async function courierStep(reservationId: string, action: "picked_up" | "on_the_way") {
  if (!UUID.test(reservationId) || !["picked_up", "on_the_way"].includes(action)) return { ok: false as const, error: "Datos no válidos." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("courier_update_reservation", { target: reservationId, action });
  if (error) return { ok: false as const, error: "No se pudo actualizar; recarga la página." };
  revalidatePath("/recolectora");
  return { ok: true as const };
}

export async function courierComplete(reservationId: string, pin: string) {
  if (!UUID.test(reservationId) || !/^\d{4}$/.test(pin)) return { ok: false as const, error: "El código de entrega tiene 4 dígitos." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("complete_reservation_with_pin", { target: reservationId, pin });
  if (error) return { ok: false as const, error: error.message.includes("wrong_pin") ? "Ese código no coincide. Pídeselo de nuevo a la clienta." : "No se pudo marcar como entregada." };
  revalidatePath("/recolectora");
  revalidatePath("/");
  return { ok: true as const };
}
