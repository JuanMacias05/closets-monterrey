"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

// Stores this browser's push subscription for the signed-in account (save_push_subscription
// moves it over if someone else used this browser before).
export async function savePushSubscription(subscription: BrowserSubscription, userAgent: string): Promise<Result> {
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://")
    || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string") {
    return { ok: false, error: "No pudimos activar las notificaciones en este navegador." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { error } = await supabase.rpc("save_push_subscription", {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth_secret: subscription.keys.auth,
    user_agent: typeof userAgent === "string" ? userAgent.slice(0, 300) : null,
  });
  if (error) return { ok: false, error: "No pudimos activar las notificaciones. Inténtalo de nuevo." };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  if (typeof endpoint !== "string") return { ok: false, error: "Datos no válidos." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  // Row security limits the delete to her own devices.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: "No pudimos desactivar las notificaciones." };
  return { ok: true };
}
