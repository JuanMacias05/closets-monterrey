"use server";

import { revalidatePath } from "next/cache";
import { isKnownMunicipality } from "@/features/delivery/zone-rates";
import type { DeliveryChoice } from "@/features/shop/checkout-steps";
import { notifyCourierRequested, notifyNewReservation, notifySellerRated } from "@/features/push/notifications";
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

// Messages for the reservation functions' error codes (raised in the migrations).
const RESERVE_ERRORS: Record<string, string> = {
  buyer_profile_required: "Antes de apartar, completa tu nombre y tu perfil de Facebook.",
  items_unavailable: "Una o más prendas acaban de ser apartadas por otra persona. Revisa tu carrito.",
  seller_without_clabe: "Esta tienda todavía no registra su CLABE; no se puede apartar por ahora.",
  seller_unavailable: "Esta tienda no está disponible por ahora.",
  own_products: "No puedes apartar prendas de tu propia tienda.",
  empty_cart: "No tienes prendas de esta tienda en tu carrito.",
  invalid_delivery: "Elige cómo quieres recibir tus prendas (y escribe tu dirección si es envío a domicilio).",
  no_delivery_rate: "Todavía no hay tarifa de envío a tu municipio para esta tienda. Elige otra forma de entrega.",
  // change_reservation_delivery (20261124000100)
  not_pending: "Este apartado ya no está esperando anticipo.",
  delivery_locked: "La entrega de este apartado ya quedó y no se puede cambiar.",
  courier_unchanged: "Ya le pediste a esa persona; espera su respuesta o elige otra.",
  courier_declined: "Esa persona ya no puede llevar este pedido. Elige otra o cambia de entrega.",
  too_many_courier_requests: "Ya pediste recolección 3 veces para este apartado. Elige punto fijo o envío a domicilio.",
};

function reserveError(message: string) {
  const code = Object.keys(RESERVE_ERRORS).find((key) => message.includes(key));
  return { ok: false as const, error: code ? RESERVE_ERRORS[code]! : "No pudimos guardar tu entrega. Inténtalo de nuevo.", code };
}

// The shape checks both reserving and changing delivery make before calling the database,
// which checks the rest (that the seller offers it, that the courier covers it).
function deliveryInputError(delivery: DeliveryChoice): string | null {
  if (!delivery || !["pickup_point", "home_delivery", "courier", "arranged"].includes(delivery.method)) return "Datos no válidos.";
  if (delivery.method === "pickup_point" && !UUID.test(delivery.pointId)) return RESERVE_ERRORS.invalid_delivery!;
  if (delivery.method === "home_delivery" && !isKnownMunicipality(delivery.municipality)) return "Elige tu municipio para calcular el envío.";
  if (delivery.method === "home_delivery" && (typeof delivery.address !== "string" || delivery.address.trim().length < 10 || delivery.address.length > 300)) {
    return "Escribe tu dirección completa (calle, número, colonia y municipio).";
  }
  if (delivery.method === "courier" && (!UUID.test(delivery.courierId) || !isKnownMunicipality(delivery.municipality)
    || !["on_delivery", "with_deposit"].includes(delivery.feePayment)
    || typeof delivery.address !== "string" || delivery.address.trim().length < 10 || delivery.address.length > 300)) {
    return "Elige tu municipio, quién recolecta, cómo pagas su tarifa y escribe tu dirección.";
  }
  return null;
}

function deliveryArgs(delivery: DeliveryChoice) {
  return {
    method: delivery.method,
    point: delivery.method === "pickup_point" ? delivery.pointId : null,
    address: delivery.method === "home_delivery" || delivery.method === "courier" ? delivery.address.trim() : null,
    courier: delivery.method === "courier" ? delivery.courierId : null,
    // The buyer's municipality prices home delivery (zone rates) and picks a courier.
    municipality: delivery.method === "courier" || delivery.method === "home_delivery" ? delivery.municipality : null,
    fee_payment: delivery.method === "courier" ? delivery.feePayment : null,
  };
}

export async function reserveFromSeller(sellerId: string, delivery: DeliveryChoice): Promise<{ ok: true; reservationId: string } | { ok: false; error: string; code?: string }> {
  if (!UUID.test(sellerId)) return { ok: false, error: "Datos no válidos." };
  const invalid = deliveryInputError(delivery);
  if (invalid) return { ok: false, error: invalid };
  const context = await signedInClient();
  if (!context.ok) return context;

  const { data, error } = await context.supabase.rpc("reserve_cart_from_seller", { target_seller: sellerId, ...deliveryArgs(delivery) });
  if (error) {
    const failure = reserveError(error.message);
    return failure.code ? failure : { ...failure, error: "No pudimos apartar las prendas. Inténtalo de nuevo." };
  }
  revalidateShop();
  revalidatePath("/cuenta");
  // A courier request lands in her "Solicitudes" and its count in her menu.
  if (delivery.method === "courier") revalidatePath("/recolectora", "layout");
  notifyNewReservation(data as string, delivery.method === "courier");
  return { ok: true, reservationId: data as string };
}

// After a courier says no (or doesn't answer), or while still waiting for her, the buyer asks
// another courier or switches to a point or home delivery.
export async function changeReservationDelivery(reservationId: string, delivery: DeliveryChoice): Promise<Result> {
  if (!UUID.test(reservationId)) return { ok: false, error: "Apartado no válido." };
  const invalid = deliveryInputError(delivery);
  if (invalid) return { ok: false, error: invalid };
  const context = await signedInClient();
  if (!context.ok) return context;

  const { error } = await context.supabase.rpc("change_reservation_delivery", { target: reservationId, ...deliveryArgs(delivery) });
  if (error) return reserveError(error.message);
  revalidatePath("/cuenta");
  revalidatePath("/panel/apartados");
  revalidatePath("/recolectora", "layout");
  if (delivery.method === "courier") notifyCourierRequested(reservationId);
  return { ok: true };
}

export async function cancelMyReservation(reservationId: string): Promise<Result> {
  if (!UUID.test(reservationId)) return { ok: false, error: "Apartado no válido." };
  const context = await signedInClient();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("update_reservation", { target: reservationId, action: "cancel" });
  if (error) return { ok: false, error: "Este apartado ya no se puede cancelar." };
  revalidateShop();
  revalidatePath("/cuenta");
  // A request still waiting is withdrawn with the reservation.
  revalidatePath("/recolectora", "layout");
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

export async function rateCourier(reservationId: string, stars: number): Promise<Result> {
  if (!UUID.test(reservationId) || !Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "Calificación no válida." };
  const context = await signedInClient();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("rate_courier", { target: reservationId, stars });
  if (error) return { ok: false, error: "Ya calificaste esta entrega." };
  revalidatePath("/cuenta");
  revalidatePath("/recolectoras");
  return { ok: true };
}

const RATE_SELLER_ERRORS: Record<string, string> = {
  invalid_comment: "El comentario es demasiado largo (máximo 280 caracteres).",
  own_store: "No puedes calificar tu propia tienda.",
  cannot_rate: "Ya calificaste esta compra, o todavía no se entrega.",
};

// The buyer rates the store once, after the purchase is completed (rate_seller,
// 20261128000100). The seller hears about it by push.
export async function rateSeller(reservationId: string, stars: number, comment: string): Promise<Result> {
  if (!UUID.test(reservationId) || !Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "Calificación no válida." };
  const text = typeof comment === "string" ? comment.trim() : "";
  if (text.length > 280) return { ok: false, error: RATE_SELLER_ERRORS.invalid_comment! };
  const context = await signedInClient();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("rate_seller", { target: reservationId, stars, comment: text || null });
  if (error) {
    const code = Object.keys(RATE_SELLER_ERRORS).find((key) => error.message.includes(key));
    return { ok: false, error: code ? RATE_SELLER_ERRORS[code]! : "No pudimos guardar tu calificación." };
  }
  notifySellerRated(reservationId, stars);
  revalidatePath("/cuenta");
  revalidatePath("/tiendas/[storeSlug]", "page");
  revalidatePath("/prendas/[slug]", "page");
  revalidatePath("/panel/calificaciones");
  return { ok: true };
}

const PROOF_ERRORS: Record<string, string> = {
  not_pending: "Este apartado ya no está esperando anticipo.",
  courier_pending: "Quien recolecta todavía no acepta. Podrás pagar tu anticipo en cuanto acepte.",
  invalid_method: "Esa forma de pago no está disponible para este apartado.",
  invalid_reference: "La clave o folio es demasiado largo.",
  invalid_proof: "No encontramos la foto que subiste. Inténtalo de nuevo.",
};

// The photo is uploaded straight from the browser to private storage first; this records it
// on the reservation. The database function checks the caller is the buyer and the file is
// in this reservation's folder.
export async function submitDepositProof(reservationId: string, path: string, method: "transfer" | "oxxo", reference: string): Promise<Result> {
  if (!UUID.test(reservationId) || typeof path !== "string" || !path.startsWith(`${reservationId}/`)
    || !["transfer", "oxxo"].includes(method) || typeof reference !== "string" || reference.length > 40) {
    return { ok: false, error: "Datos no válidos." };
  }
  const context = await signedInClient();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("submit_deposit_proof", { target: reservationId, path, method, reference: reference.trim() || null });
  if (error) {
    const code = Object.keys(PROOF_ERRORS).find((key) => error.message.includes(key));
    return { ok: false, error: code ? PROOF_ERRORS[code]! : "No pudimos guardar tu comprobante. Inténtalo de nuevo." };
  }
  revalidatePath("/cuenta");
  revalidatePath("/panel/apartados");
  return { ok: true };
}

export type SupportReason = "proof_rejected" | "proof_not_reviewed" | "released_after_paying" | "other";

export async function requestSupport(reservationId: string, reason: SupportReason, message: string): Promise<Result> {
  if (!UUID.test(reservationId) || !["proof_rejected", "proof_not_reviewed", "released_after_paying", "other"].includes(reason)
    || typeof message !== "string") {
    return { ok: false, error: "Datos no válidos." };
  }
  const text = message.trim();
  if (text.length < 5 || text.length > 1000) return { ok: false, error: "Cuéntanos qué pasó en al menos 5 caracteres." };
  const context = await signedInClient();
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc("request_support", { target: reservationId, why: reason, message: text });
  if (error) return { ok: false, error: "No pudimos enviar tu solicitud. Inténtalo de nuevo." };
  revalidatePath("/cuenta");
  revalidatePath("/panel/admin/soporte");
  return { ok: true };
}
