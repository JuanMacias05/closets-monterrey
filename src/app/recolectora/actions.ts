"use server";

import { revalidatePath } from "next/cache";
import { MUNICIPALITIES } from "@/features/couriers/constants";
import { notifyCourierAnswer } from "@/features/push/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

type Result = { ok: true } | { ok: false; error: string };

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión." };
  return { ok: true as const, supabase, userId: user.id };
}

// The courier's whole area reads counts in its layout (the menu badge), so every change
// refreshes the layout, not just one page.
function revalidateCourierArea() {
  revalidatePath("/recolectora", "layout");
}

type CourierRouteInput = { municipalities: string[]; days: number[]; timeWindow: string; pointIds: string[] };

export async function saveCourierRoute(input: CourierRouteInput): Promise<Result> {
  if (!input || !Array.isArray(input.municipalities) || !Array.isArray(input.days) || !Array.isArray(input.pointIds)
    || input.municipalities.some((m) => !(MUNICIPALITIES as readonly string[]).includes(m))
    || input.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    || input.pointIds.some((id) => typeof id !== "string" || !UUID.test(id))
    || typeof input.timeWindow !== "string") {
    return { ok: false, error: "Revisa tus datos de ruta." };
  }
  const context = await signedIn();
  if (!context.ok) return context;
  const { supabase, userId } = context;

  const { error } = await supabase.from("couriers").update({
    municipalities: [...new Set(input.municipalities)],
    days: [...new Set(input.days)].toSorted(),
    time_window: input.timeWindow.trim().slice(0, 60) || null,
  }).eq("id", userId);
  if (error) return { ok: false, error: "No pudimos guardar tu ruta." };

  // Replace the whole set: a courier has a handful of points.
  const { error: clearError } = await supabase.from("courier_pickup_points").delete().eq("courier_id", userId);
  const ids = [...new Set(input.pointIds)];
  const { error: insertError } = clearError || ids.length === 0
    ? { error: clearError }
    : await supabase.from("courier_pickup_points").insert(ids.map((pointId) => ({ courier_id: userId, point_id: pointId })));
  if (clearError || insertError) return { ok: false, error: "No pudimos guardar tus puntos de recolección." };

  revalidateCourierArea();
  revalidatePath("/recolectoras");
  return { ok: true };
}

export async function saveCourierFee(fee: string): Promise<Result> {
  const value = Number(typeof fee === "string" ? fee.trim() || "0" : "x");
  if (!Number.isFinite(value) || value < 0 || value > 1000) return { ok: false, error: "La tarifa debe estar entre $0 y $1,000." };
  const context = await signedIn();
  if (!context.ok) return context;
  const { error } = await context.supabase.from("couriers").update({ fee_mxn: Math.round(value * 100) }).eq("id", context.userId);
  if (error) return { ok: false, error: "No pudimos guardar tu tarifa." };
  revalidateCourierArea();
  revalidatePath("/recolectoras");
  return { ok: true };
}

const REQUEST_ERRORS: Record<string, string> = {
  request_closed: "Esta solicitud ya no está abierta: se venció, la clienta cambió de entrega o ya la respondiste.",
  courier_not_approved: "Tu cuenta aún no está verificada, así que todavía no puedes aceptar entregas.",
  invalid_reason: "El motivo es demasiado largo (máximo 160 caracteres).",
  not_found: "No encontramos esta solicitud.",
};

function requestError(message: string): Result {
  const code = Object.keys(REQUEST_ERRORS).find((key) => message.includes(key));
  return { ok: false, error: code ? REQUEST_ERRORS[code]! : "No pudimos guardar tu respuesta; recarga la página." };
}

// Thin wrappers: accept_courier_request / reject_courier_request check that she is the courier
// asked and that the request is still waiting (20261124000100).
export async function acceptCourierRequest(requestId: string): Promise<Result> {
  if (!UUID.test(requestId)) return { ok: false, error: "Solicitud no válida." };
  const context = await signedIn();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("accept_courier_request", { request: requestId });
  if (error) return requestError(error.message);
  notifyCourierAnswer(requestId, true);
  revalidateCourierArea();
  revalidatePath("/cuenta");
  revalidatePath("/panel/apartados");
  return { ok: true };
}

export async function rejectCourierRequest(requestId: string, reason: string): Promise<Result> {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (!UUID.test(requestId) || text.length > 160) return { ok: false, error: "El motivo es demasiado largo (máximo 160 caracteres)." };
  const context = await signedIn();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("reject_courier_request", { request: requestId, reason: text || null });
  if (error) return requestError(error.message);
  notifyCourierAnswer(requestId, false);
  revalidateCourierArea();
  revalidatePath("/cuenta");
  revalidatePath("/panel/apartados");
  return { ok: true };
}

export async function courierStep(reservationId: string, action: "picked_up" | "on_the_way"): Promise<Result> {
  if (!UUID.test(reservationId) || !["picked_up", "on_the_way"].includes(action)) return { ok: false, error: "Datos no válidos." };
  const context = await signedIn();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("courier_update_reservation", { target: reservationId, action });
  if (error) return { ok: false, error: "No se pudo actualizar; recarga la página." };
  revalidateCourierArea();
  return { ok: true };
}

export async function courierComplete(reservationId: string, pin: string): Promise<Result> {
  if (!UUID.test(reservationId) || !/^\d{4}$/.test(pin)) return { ok: false, error: "El código de entrega tiene 4 dígitos." };
  const context = await signedIn();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("complete_reservation_with_pin", { target: reservationId, pin });
  if (error) return { ok: false, error: error.message.includes("wrong_pin") ? "Ese código no coincide. Pídeselo de nuevo a la clienta." : "No se pudo marcar como entregada." };
  revalidateCourierArea();
  revalidatePath("/");
  return { ok: true };
}
