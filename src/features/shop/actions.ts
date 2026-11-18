"use server";

import { revalidatePath } from "next/cache";
import { isValidFacebookUrl, normalizeFacebookUrl } from "@/features/shop/facebook-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string; code?: string };

const UUID = /^[0-9a-f-]{36}$/i;

async function signedInClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase no está configurado." };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, error: "Inicia sesión para continuar.", code: "signed_out" };
  return { ok: true as const, supabase, userId: user.id };
}

function revalidateShop() {
  revalidatePath("/");
  revalidatePath("/favoritos");
  revalidatePath("/carrito");
}

export async function setFavorite(productId: string, favorite: boolean): Promise<Result> {
  if (!UUID.test(productId) || typeof favorite !== "boolean") return { ok: false, error: "Prenda no válida." };
  const context = await signedInClient();
  if (!context.ok) return context;

  const { error } = favorite
    ? await context.supabase.from("favorites").upsert({ buyer_id: context.userId, product_id: productId }, { ignoreDuplicates: true })
    : await context.supabase.from("favorites").delete().eq("buyer_id", context.userId).eq("product_id", productId);
  if (error) return { ok: false, error: "No pudimos guardar tu favorito." };
  revalidateShop();
  return { ok: true };
}

export async function setInCart(productId: string, inCart: boolean): Promise<Result> {
  if (!UUID.test(productId) || typeof inCart !== "boolean") return { ok: false, error: "Prenda no válida." };
  const context = await signedInClient();
  if (!context.ok) return context;

  if (inCart) {
    const { data: product } = await context.supabase.from("products")
      .select("seller_id,sale_status").eq("id", productId).maybeSingle();
    if (!product) return { ok: false, error: "No encontramos esa prenda." };
    if (product.seller_id === context.userId) return { ok: false, error: "Es una prenda de tu propia tienda." };
    if (product.sale_status !== "available") return { ok: false, error: "Esta prenda ya no está disponible." };
    const { error } = await context.supabase.from("cart_items")
      .upsert({ buyer_id: context.userId, product_id: productId }, { ignoreDuplicates: true });
    if (error) return { ok: false, error: "No pudimos agregarla al carrito." };
  } else {
    const { error } = await context.supabase.from("cart_items").delete()
      .eq("buyer_id", context.userId).eq("product_id", productId);
    if (error) return { ok: false, error: "No pudimos quitarla del carrito." };
  }
  revalidateShop();
  return { ok: true };
}

// Messages for the reservation function's error codes (raised in the migration).
const RESERVE_ERRORS: Record<string, string> = {
  buyer_profile_required: "Antes de apartar, completa tu nombre y tu perfil de Facebook.",
  items_unavailable: "Una o más prendas acaban de ser apartadas por otra persona. Revisa tu carrito.",
  seller_without_clabe: "Esta vendedora todavía no registra su CLABE; no se puede apartar por ahora.",
  seller_unavailable: "Esta vendedora no está disponible por ahora.",
  own_products: "No puedes apartar prendas de tu propia tienda.",
  empty_cart: "No tienes prendas de esta vendedora en tu carrito.",
  invalid_delivery: "Elige cómo quieres recibir tus prendas (y escribe tu dirección si es envío a domicilio).",
};

export type DeliveryChoice =
  | { method: "pickup_point"; pointId: string }
  | { method: "home_delivery"; address: string }
  | { method: "arranged" };

export async function reserveFromSeller(sellerId: string, delivery: DeliveryChoice): Promise<{ ok: true; reservationId: string } | { ok: false; error: string; code?: string }> {
  if (!UUID.test(sellerId) || !delivery || !["pickup_point", "home_delivery", "arranged"].includes(delivery.method)) {
    return { ok: false, error: "Datos no válidos." };
  }
  if (delivery.method === "pickup_point" && !UUID.test(delivery.pointId)) return { ok: false, error: RESERVE_ERRORS.invalid_delivery! };
  if (delivery.method === "home_delivery" && (typeof delivery.address !== "string" || delivery.address.trim().length < 10 || delivery.address.length > 300)) {
    return { ok: false, error: "Escribe tu dirección completa (calle, número, colonia y municipio)." };
  }
  const context = await signedInClient();
  if (!context.ok) return context;

  const { data, error } = await context.supabase.rpc("reserve_cart_from_seller", {
    target_seller: sellerId,
    method: delivery.method,
    point: delivery.method === "pickup_point" ? delivery.pointId : null,
    address: delivery.method === "home_delivery" ? delivery.address.trim() : null,
  });
  if (error) {
    const code = Object.keys(RESERVE_ERRORS).find((key) => error.message.includes(key));
    return { ok: false, error: code ? RESERVE_ERRORS[code]! : "No pudimos apartar las prendas. Inténtalo de nuevo.", code };
  }
  revalidateShop();
  revalidatePath("/cuenta");
  return { ok: true, reservationId: data as string };
}

export async function cancelMyReservation(reservationId: string): Promise<Result> {
  if (!UUID.test(reservationId)) return { ok: false, error: "Apartado no válido." };
  const context = await signedInClient();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("update_reservation", { target: reservationId, action: "cancel" });
  if (error) return { ok: false, error: "Este apartado ya no se puede cancelar." };
  revalidateShop();
  revalidatePath("/cuenta");
  return { ok: true };
}

// Creates or updates the caller's buyer profile. Sellers who shop fill it in at checkout.
export async function saveBuyerProfile(input: { fullName: string; facebookUrl: string }): Promise<Result> {
  if (!input || typeof input.fullName !== "string" || typeof input.facebookUrl !== "string") {
    return { ok: false, error: "Revisa tus datos." };
  }
  const fullName = input.fullName.trim();
  const facebookUrl = normalizeFacebookUrl(input.facebookUrl);
  if (fullName.length < 2 || fullName.length > 80) return { ok: false, error: "Escribe tu nombre (2 a 80 caracteres)." };
  if (!facebookUrl || !isValidFacebookUrl(facebookUrl)) return { ok: false, error: "Pega el link de tu perfil de Facebook, por ejemplo https://facebook.com/tu.nombre" };

  const context = await signedInClient();
  if (!context.ok) return context;
  const { error } = await context.supabase.from("buyer_profiles")
    .upsert({ id: context.userId, full_name: fullName, facebook_url: facebookUrl }, { onConflict: "id" });
  if (error) return { ok: false, error: "No pudimos guardar tus datos." };
  revalidatePath("/cuenta");
  revalidatePath("/carrito");
  return { ok: true };
}
