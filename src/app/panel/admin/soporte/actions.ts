"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The database function checks the caller is an admin.
export async function resolveSupportRequest(requestId: string, note: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || typeof note !== "string" || note.length > 1000) {
    return { ok: false as const, error: "Datos no válidos." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("resolve_support_request", { target: requestId, note: note.trim() });
  if (error) return { ok: false as const, error: "No se pudo marcar como resuelta; recarga la página." };
  revalidatePath("/panel/admin/soporte");
  revalidatePath("/panel");
  return { ok: true as const };
}

// Store ratings: hide an abusive comment without touching the stars (set_seller_rating_hidden
// re-checks admin in the database).
export async function setRatingCommentHidden(reservationId: string, hidden: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId) || typeof hidden !== "boolean") return { ok: false as const, error: "Datos no válidos." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("set_seller_rating_hidden", { target: reservationId, hidden });
  if (error) return { ok: false as const, error: "No pudimos cambiar el comentario." };
  revalidatePath("/panel/admin/soporte");
  revalidatePath("/panel/calificaciones");
  return { ok: true as const };
}
